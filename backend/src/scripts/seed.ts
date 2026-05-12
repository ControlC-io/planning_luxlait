import { PrismaClient } from '@prisma/client';
import prisma from '../lib/prisma';

export const seedAuthSettings = async (client: PrismaClient = prisma): Promise<void> => {
  console.log('Seeding auth configuration settings...');

  const settings = [
    {
      settingKey: 'auth_email_password_enabled',
      isEnabled: true
    },
    {
      settingKey: 'auth_google_enabled',
      isEnabled: false,
      providerConfig: {
        clientId: '',
        clientSecret: '',
        note: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable'
      }
    },
    {
      settingKey: 'auth_github_enabled',
      isEnabled: false,
      providerConfig: {
        clientId: '',
        clientSecret: '',
        note: 'Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env to enable'
      }
    }
  ];

  for (const setting of settings) {
    const existing = await client.systemSettings.findUnique({
      where: { settingKey: setting.settingKey }
    });

    if (existing) {
      console.log(`  = ${setting.settingKey} already exists`);
    } else {
      await client.systemSettings.create({
        data: setting
      });
      console.log(`  + Created ${setting.settingKey} (enabled: ${setting.isEnabled})`);
    }
  }

  console.log('Auth settings seeded successfully.');
};

export const seedRoles = async (client: PrismaClient = prisma): Promise<void> => {
  console.log('Seeding default RBAC roles...');

  const defaultRoles = [
    { name: 'Admin User', description: 'Full system access' },
    { name: 'Manager', description: 'Read and write access to core resources' },
  ];

  for (const role of defaultRoles) {
    const existing = await client.role.findUnique({
      where: { name: role.name },
    });

    if (existing) {
      console.log(`  = Role "${role.name}" already exists`);
    } else {
      await client.role.create({
        data: role,
      });
      console.log(`  + Created role "${role.name}"`);
    }
  }

  console.log('Default roles seeded successfully.');
};

export const seedPlanningRbac = async (client: PrismaClient = prisma): Promise<void> => {
  console.log('Seeding RBAC for planning endpoints...');

  const adminRole = await client.role.findUnique({ where: { name: 'Admin User' } });
  const managerRole = await client.role.findUnique({ where: { name: 'Manager' } });

  if (!adminRole || !managerRole) {
    console.log('  Skipping planning RBAC seeding (roles not found yet).');
    return;
  }

  const endpoint = '/api/planning';
  const method = '*';

  const ensureMapping = async (roleId: string) => {
    const existing = await client.roleEndpointMapping.findUnique({
      where: {
        roleId_endpoint_method: {
          roleId,
          endpoint,
          method,
        },
      },
    });

    if (!existing) {
      await client.roleEndpointMapping.create({
        data: { roleId, endpoint, method },
      });
      console.log(`  + Created endpoint mapping for role ${roleId}: ${method} ${endpoint}`);
    }
  };

  await ensureMapping(adminRole.id);
  await ensureMapping(managerRole.id);

  console.log('Seeding manager role assignment for existing non admin users...');
  const managerId = managerRole.id;
  const adminId = adminRole.id;
  const users = await client.user.findMany({
    select: {
      id: true,
      userRoles: { select: { roleId: true } },
    },
  });

  for (const u of users) {
    const isAdmin = u.userRoles.some((r) => r.roleId === adminId);
    if (isAdmin) continue;

    const existing = await client.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: u.id,
          roleId: managerId,
        },
      },
    });

    if (!existing) {
      await client.userRole.create({
        data: { userId: u.id, roleId: managerId },
      });
    }
  }
};

const main = async () => {
  try {
    await seedAuthSettings();
    await seedRoles();
    await seedPlanningRbac();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

if (require.main === module) {
  void main();
}
