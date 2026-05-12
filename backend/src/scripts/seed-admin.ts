import dotenv from 'dotenv';
dotenv.config();

import prisma from '../lib/prisma';
import { auth } from '../lib/auth';

const ADMIN_ROLE_NAME = 'Admin User';

const readAdminCredentials = () => {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';

  if (!email) {
    throw new Error(
      'Missing ADMIN_EMAIL environment variable. Set it in the .env file before bootstrapping.'
    );
  }
  if (!password || password.length < 8) {
    throw new Error(
      'Missing or too short ADMIN_PASSWORD environment variable (minimum 8 characters).'
    );
  }

  return { email: email.toLowerCase(), password, name };
};

const ensureAdminRoleAssigned = async (userId: string): Promise<void> => {
  const role = await prisma.role.findUnique({ where: { name: ADMIN_ROLE_NAME } });
  if (!role) {
    throw new Error(
      `Role "${ADMIN_ROLE_NAME}" not found. Run seedRoles before seedAdmin.`
    );
  }

  const existing = await prisma.userRole.findUnique({
    where: {
      userId_roleId: {
        userId,
        roleId: role.id,
      },
    },
  });

  if (existing) {
    console.log(`  = Admin role already assigned to user ${userId}`);
    return;
  }

  await prisma.userRole.create({
    data: { userId, roleId: role.id },
  });
  console.log(`  + Assigned "${ADMIN_ROLE_NAME}" role to user ${userId}`);
};

const ensureLuxlaitProfile = async (userId: string, displayName: string): Promise<void> => {
  const existing = await prisma.luxlaitProfile.findUnique({ where: { userId } });
  if (existing) {
    return;
  }

  await prisma.luxlaitProfile.create({
    data: { userId, displayName },
  });
  console.log(`  + Created LuxlaitProfile for user ${userId}`);
};

export const seedAdmin = async (): Promise<void> => {
  console.log('Seeding admin account...');
  const { email, password, name } = readAdminCredentials();

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    console.log(`  = Admin user "${email}" already exists (id=${existingUser.id})`);
    await ensureAdminRoleAssigned(existingUser.id);
    await ensureLuxlaitProfile(existingUser.id, name);

    if (!existingUser.emailVerified) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { emailVerified: true },
      });
      console.log(`  + Marked admin email as verified`);
    }
    console.log('Admin account already provisioned.');
    return;
  }

  console.log(`  + Creating admin user "${email}" via Better Auth...`);
  try {
    await auth.api.signUpEmail({
      body: { email, password, name },
    });
  } catch (error) {
    console.error('Better Auth signUpEmail failed for admin bootstrap:', error);
    throw error;
  }

  const createdUser = await prisma.user.findUnique({ where: { email } });
  if (!createdUser) {
    throw new Error('Admin user creation reported success but user was not persisted.');
  }

  await prisma.user.update({
    where: { id: createdUser.id },
    data: { emailVerified: true, name },
  });
  console.log(`  + Admin user persisted (id=${createdUser.id}) with verified email`);

  await ensureAdminRoleAssigned(createdUser.id);
  await ensureLuxlaitProfile(createdUser.id, name);

  console.log('Admin account seeded successfully.');
};

const main = async () => {
  try {
    await seedAdmin();
  } catch (error) {
    console.error('seed-admin failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

if (require.main === module) {
  void main();
}
