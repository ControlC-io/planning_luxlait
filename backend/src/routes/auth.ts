import crypto from 'crypto';
import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { verifyPassword } from 'better-auth/crypto';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { sendOtp } from '../lib/emailService';
import { auth } from '../lib/auth';

const router = express.Router();

const OTP_EXPIRY_MINUTES = 10;
const OTP_IDENTIFIER_PREFIX = '2fa:';

function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

function issueJwt(user: { id: string; email: string }, roles: string[]): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  const expiresIn = (process.env.JWT_EXPIRES_IN as string) || '8h';
  return jwt.sign({ userId: user.id, email: user.email, roles }, secret, {
    expiresIn,
  } as jwt.SignOptions);
}

/**
 * @swagger
 * /api/auth/jwt-from-session:
 *   get:
 *     summary: Obtain a JWT from the current Better Auth session
 *     description: >
 *       If the request has a valid session cookie, returns a signed JWT for that user.
 *       Use when the user has logged in via session (e.g. TOTP 2FA) but the frontend
 *       needs a JWT for API calls (e.g. Bearer Authorization).
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: JWT issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 expiresIn:
 *                   type: string
 *       401:
 *         description: No valid session
 *       500:
 *         description: Server error
 */
router.get('/jwt-from-session', async (req: Request, res: Response): Promise<void> => {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
      }
    }

    const session = await auth.api.getSession({
      headers,
    });

    if (!session?.user) {
      res.status(401).json({ error: 'No valid session' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const expiresIn = (process.env.JWT_EXPIRES_IN as string) || '8h';
    const token = issueJwt(user, roles);

    res.json({ token, expiresIn });
  } catch (error) {
    console.error('Error issuing JWT from session:', error);
    res.status(500).json({ error: 'Failed to issue token from session' });
  }
});

/**
 * @swagger
 * /api/auth/token:
 *   post:
 *     summary: Obtain a JWT access token (supports 2FA)
 *     description: >
 *       Authenticates a user with email and password.
 *       If the user has 2FA enabled, returns `{ requires2FA: true, userId }` instead of
 *       a token — the client must then call `/api/auth/verify-otp` with the emailed code.
 *       Otherwise returns a signed JWT immediately.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: supersecret
 *     responses:
 *       200:
 *         description: JWT issued (no 2FA) or OTP sent (2FA required)
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     expiresIn:
 *                       type: string
 *                     user:
 *                       type: object
 *                 - type: object
 *                   properties:
 *                     requires2FA:
 *                       type: boolean
 *                       example: true
 *                     userId:
 *                       type: string
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post('/token', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        accounts: {
          where: { providerId: 'credential' },
          select: { password: true },
        },
        userRoles: {
          include: { role: { select: { name: true } } },
        },
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const credentialAccount = user.accounts[0];
    if (!credentialAccount?.password) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const stored = credentialAccount.password;
    let passwordValid = false;
    if (stored.startsWith('$2')) {
      passwordValid = await bcrypt.compare(password, stored);
    } else {
      try {
        passwordValid = await verifyPassword({ hash: stored, password });
      } catch {
        passwordValid = false;
      }
    }
    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const roles = user.userRoles.map((ur) => ur.role.name);

    // ── 2FA gate ─────────────────────────────────────────────────────────────
    if (user.twoFactorEnabled) {
      const identifier = `${OTP_IDENTIFIER_PREFIX}${user.id}`;
      const code = generateOtp();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      // Replace any previous pending OTP for this user
      await prisma.verification.deleteMany({ where: { identifier } });
      await prisma.verification.create({ data: { identifier, value: code, expiresAt } });

      await sendOtp(user.email, code, OTP_EXPIRY_MINUTES);

      res.json({ requires2FA: true, userId: user.id });
      return;
    }

    // ── No 2FA: issue JWT immediately ─────────────────────────────────────────
    const expiresIn = (process.env.JWT_EXPIRES_IN as string) || '8h';
    const token = issueJwt(user, roles);

    res.json({ token, expiresIn, user: { id: user.id, email: user.email, name: user.name, roles } });
  } catch (error) {
    console.error('Error issuing token:', error);
    const message = error instanceof Error ? error.message : 'Failed to issue token';
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      error: 'Failed to issue token',
      ...(isDev ? { detail: message } : {}),
    });
  }
});

// In-memory rate limit for "request email OTP" (by email): max 5 per 15 minutes
const emailOtpRequestCount = new Map<string, { count: number; resetAt: number }>();
const EMAIL_OTP_RATE_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_OTP_RATE_MAX = 5;

function checkEmailOtpRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = emailOtpRequestCount.get(email.toLowerCase());
  if (!entry) return true;
  if (now >= entry.resetAt) {
    emailOtpRequestCount.delete(email.toLowerCase());
    return true;
  }
  return entry.count < EMAIL_OTP_RATE_MAX;
}

function incrementEmailOtpRateLimit(email: string): void {
  const key = email.toLowerCase();
  const now = Date.now();
  const entry = emailOtpRequestCount.get(key);
  if (!entry || now >= entry.resetAt) {
    emailOtpRequestCount.set(key, { count: 1, resetAt: now + EMAIL_OTP_RATE_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

/**
 * @swagger
 * /api/auth/request-email-otp:
 *   post:
 *     summary: Request a 2FA code by email (alternative to TOTP on the 2FA challenge page)
 *     description: >
 *       Call this from the Two-Factor Authentication page when the user chooses
 *       "Use code sent to my email instead". Sends a 6-digit OTP to the user's email
 *       and returns userId for use with POST /api/auth/verify-otp.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Required if no session; used when user is on 2FA challenge page.
 *     responses:
 *       200:
 *         description: OTP sent; use returned userId with verify-otp
 *       400:
 *         description: Missing email
 *       401:
 *         description: Could not identify user (no session and no/invalid email)
 *       404:
 *         description: User not found or 2FA not enabled (same response to avoid enumeration)
 *       429:
 *         description: Too many requests (rate limited)
 */
router.post('/request-email-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    let user: { id: string; email: string } | null = null;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
      }
    }
    const session = await auth.api.getSession({ headers });
    if (session?.user) {
      const u = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, twoFactorEnabled: true },
      });
      if (u?.twoFactorEnabled) user = { id: u.id, email: u.email };
    }

    if (!user) {
      const email = (req.body as { email?: string })?.email?.trim();
      if (!email) {
        res.status(400).json({ error: 'email is required when no session' });
        return;
      }
      if (!checkEmailOtpRateLimit(email)) {
        res.status(429).json({ error: 'Too many email code requests. Try again later.' });
        return;
      }
      const u = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), twoFactorEnabled: true },
        select: { id: true, email: true },
      });
      if (!u) {
        res.status(404).json({ error: 'User not found or 2FA not enabled' });
        return;
      }
      user = { id: u.id, email: u.email };
      incrementEmailOtpRateLimit(email);
    }

    const identifier = `${OTP_IDENTIFIER_PREFIX}${user.id}`;
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await prisma.verification.deleteMany({ where: { identifier } });
    await prisma.verification.create({ data: { identifier, value: code, expiresAt } });
    await sendOtp(user.email, code, OTP_EXPIRY_MINUTES);

    res.json({ userId: user.id });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Error requesting email OTP:', error);
    const isUnavailable =
      !errMsg ||
      errMsg.includes('EMAIL_SERVICE_SECRET') ||
      errMsg.includes('ECONNREFUSED') ||
      errMsg.includes('ENOTFOUND') ||
      errMsg.includes('fetch failed') ||
      errMsg.includes('Email service responded');
    const isSendGridRejected = errMsg.includes('Forbidden') || errMsg.includes('403');
    const status = isUnavailable || isSendGridRejected ? 503 : 500;
    const userMessage = isSendGridRejected
      ? 'Email was rejected (check SendGrid: verify sender and API key). Use your authenticator app or a backup code.'
      : isUnavailable
        ? 'Email service is unavailable. Use your authenticator app or a backup code.'
        : 'Failed to send email code. Use your authenticator app or a backup code.';
    res.status(status).json({ error: userMessage });
  }
});

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify a 2FA OTP code and obtain a JWT
 *     description: >
 *       Second step of the 2FA login flow. Submit the userId from `/api/auth/token`
 *       and the 6-digit code sent to the user's email. Returns a signed JWT on success.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - code
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "abc123"
 *               code:
 *                 type: string
 *                 example: "482910"
 *     responses:
 *       200:
 *         description: JWT issued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 expiresIn:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Missing userId or code
 *       401:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/verify-otp', async (req: Request, res: Response): Promise<void> => {
  const { userId, code } = req.body as { userId?: string; code?: string };

  if (!userId || !code) {
    res.status(400).json({ error: 'userId and code are required' });
    return;
  }

  try {
    const identifier = `${OTP_IDENTIFIER_PREFIX}${userId}`;

    const verification = await prisma.verification.findFirst({ where: { identifier } });

    if (!verification) {
      res.status(401).json({ error: 'Invalid or expired OTP' });
      return;
    }

    if (new Date() > verification.expiresAt) {
      await prisma.verification.delete({ where: { id: verification.id } });
      res.status(401).json({ error: 'OTP has expired' });
      return;
    }

    if (verification.value !== code) {
      res.status(401).json({ error: 'Invalid OTP' });
      return;
    }

    // Consume the OTP — one-time use
    await prisma.verification.delete({ where: { id: verification.id } });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const expiresIn = (process.env.JWT_EXPIRES_IN as string) || '8h';
    const token = issueJwt(user, roles);

    res.json({ token, expiresIn, user: { id: user.id, email: user.email, name: user.name, roles } });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

export default router;
