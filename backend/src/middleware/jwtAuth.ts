import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { hasRoleAccess } from '../lib/rbac';

export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
}

// Augment Express Request to carry the decoded JWT user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      userRoles?: string[];
    }
  }
}

/**
 * Routes that do not require a JWT.
 * Matching is done against `${method}:${path}` or `*:${path}` for method wildcards.
 */
const PUBLIC_ROUTES: Array<{ method: string; pathPrefix: string }> = [
  { method: 'GET',  pathPrefix: '/api/health' },
  { method: 'GET',  pathPrefix: '/api/docs' },
  { method: 'GET',  pathPrefix: '/api$' },   // exact /api only
  { method: 'POST', pathPrefix: '/api/auth/token' },
  { method: 'POST', pathPrefix: '/api/auth/verify-otp' },
  { method: '*',    pathPrefix: '/api/auth/' },
  { method: '*',    pathPrefix: '/api/admin' },  // admin uses x-admin-secret via adminAuth
];

function isPublicRoute(method: string, path: string): boolean {
  return PUBLIC_ROUTES.some(({ method: m, pathPrefix }) => {
    const methodMatch = m === '*' || m === method.toUpperCase();
    // Support a trailing $ to signal an exact match
    const exactMatch = pathPrefix.endsWith('$');
    const cleanPrefix = exactMatch ? pathPrefix.slice(0, -1) : pathPrefix;
    const pathMatch = exactMatch ? path === cleanPrefix : path.startsWith(cleanPrefix);
    return methodMatch && pathMatch;
  });
}

/**
 * Centralized JWT authentication + RBAC middleware.
 *
 * 1. Skips public routes.
 * 2. Extracts and verifies the Bearer JWT from the Authorization header.
 * 3. Loads user roles and checks endpoint access via RoleEndpointMapping.
 * 4. Attaches decoded payload to req.user for downstream handlers.
 */
export const jwtAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Allow CORS preflight requests to complete without requiring auth.
  // The `cors()` middleware already runs earlier and will set the required headers.
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  if (isPublicRoute(req.method, req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('JWT_SECRET is not set');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, secret) as JwtPayload;
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
    return;
  }

  // Attach user info early so downstream handlers can use it even before RBAC check
  req.user = payload;
  req.userRoles = payload.roles;

  // Global admin bypass: if token carries an admin role, allow access.
  const normalizedRoles = (payload.roles ?? []).map((r) => String(r).toLowerCase());
  if (normalizedRoles.some((r) => r.includes('admin'))) {
    next();
    return;
  }

  // RBAC: verify the user has a role that permits this endpoint
  const allowed = await hasRoleAccess(payload.userId, req.method, req.path);
  if (!allowed) {
    res.status(403).json({
      error: 'Forbidden: your role does not have access to this endpoint',
      endpoint: req.path,
      method: req.method,
    });
    return;
  }

  next();
};
