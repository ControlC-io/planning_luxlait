import dotenv from 'dotenv';

dotenv.config();

import { hashPassword } from 'better-auth/crypto';
import prisma from '../lib/prisma';

/**
 * Rewrites the credential account password using the same hashing as Better Auth
 * (scrypt salt:hex). Use when you know ADMIN_EMAIL and want ADMIN_PASSWORD from .env
 * to become the new login password for /api/auth/token.
 */
const main = async (): Promise<void> => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email) {
    throw new Error('Set ADMIN_EMAIL in .env');
  }
  if (!password || password.length < 8) {
    throw new Error('Set ADMIN_PASSWORD in .env (minimum 8 characters)');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No user with email ${email}`);
  }

  const account = await prisma.account.findFirst({
    where: { userId: user.id, providerId: 'credential' },
  });
  if (!account) {
    throw new Error(`No credential account for ${email}`);
  }

  const hashed = await hashPassword(password);
  await prisma.account.update({
    where: { id: account.id },
    data: { password: hashed },
  });

  console.log(`Credential password updated for ${email}.`);
};

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
