import dotenv from 'dotenv';
dotenv.config();

import prisma from '../lib/prisma';
import { seedAuthSettings, seedRoles, seedPlanningRbac } from './seed';
import { seedAdmin } from './seed-admin';
import { seedLuxlaitReal } from './seed-luxlait-real';

/**
 * Production bootstrap orchestrator.
 *
 * Idempotent first boot seeder for a freshly deployed VM:
 *   1. SystemSettings (auth flags) and RBAC roles are upserted defensively.
 *   2. The admin user is created via Better Auth with credentials from the
 *      environment, and assigned the "Admin User" role + LuxlaitProfile.
 *   3. The Luxlait reference data (machines, employees, time slots, skills,
 *      open shifts, closed shifts, staffing requirements, default leaves) is
 *      inserted ONLY when both luxlait_machines and luxlait_employees are
 *      empty. If any of these tables already contains data, the Luxlait seed
 *      is skipped to guarantee no destructive behaviour after the first
 *      deploy.
 *
 * Solver constraints are not seeded here: they are populated directly through
 * the Prisma migration "20260508120000_add_solver_constraints".
 */
const bootstrap = async (): Promise<void> => {
  console.log('===== Luxlait production bootstrap =====');
  const startedAt = Date.now();

  await seedAuthSettings();
  await seedRoles();
  await seedAdmin();
  await seedPlanningRbac();
  await seedLuxlaitReal({ purge: false, skipIfPopulated: true });

  const elapsedMs = Date.now() - startedAt;
  console.log(`===== Bootstrap completed in ${elapsedMs} ms =====`);
};

const main = async () => {
  try {
    await bootstrap();
  } catch (error) {
    console.error('Bootstrap failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

if (require.main === module) {
  void main();
}
