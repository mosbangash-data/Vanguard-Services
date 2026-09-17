require('dotenv').config();

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const requiredEnvironmentVariables = ['DATABASE_URL', 'SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_PASSWORD'];
const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (name) => !process.env[name] || String(process.env[name]).trim() === '',
);

if (missingEnvironmentVariables.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvironmentVariables.join(', ')}`);
}

const databaseUrl = String(process.env.DATABASE_URL).replace(/^['"]|['"]$/g, '').trim();
const email = String(process.env.SUPER_ADMIN_EMAIL).trim().toLowerCase();
const password = String(process.env.SUPER_ADMIN_PASSWORD);

if (!databaseUrl) {
  throw new Error('DATABASE_URL must not be empty');
}

if (!email) {
  throw new Error('SUPER_ADMIN_EMAIL must not be empty');
}

if (!password) {
  throw new Error('SUPER_ADMIN_PASSWORD must not be empty');
}

const superAdminPermissionNames = [
  'CREATE_RESERVATION',
  'VIEW_RESERVATION',
  'UPDATE_RESERVATION',
  'CANCEL_VEHICLE_RESERVATION',
  'MANAGE_RESERVATION_PAYMENT',
  'VIEW_TRIP',
  'VIEW_PAYMENT',
  'VIEW_OCCUPANCY',
  'SCAN_TICKET',
  'VIEW_TICKET_SCAN',
  'MANAGE_USERS',
  'VIEW_VEHICLE',
  'CREATE_VEHICLE',
  'UPDATE_VEHICLE',
  'DELETE_VEHICLE',
  'MANAGE_VEHICLE_MEDIA',
  'VIEW_VEHICLE_INQUIRY',
  'CREATE_VEHICLE_INQUIRY',
  'UPDATE_VEHICLE_INQUIRY',
  'ASSIGN_VEHICLE_INQUIRY',
  'CLOSE_VEHICLE_INQUIRY',
  'MANAGE_VEHICLE_INQUIRY',
  'MANAGE_VEHICLE_RESERVATION',
  'CREATE_CUSTOMER_REQUEST',
  'VIEW_CUSTOMER_REQUEST',
  'UPDATE_CUSTOMER_REQUEST',
  'CREATE_QUOTE_REQUEST',
  'VIEW_QUOTE_REQUEST',
  'UPDATE_QUOTE_REQUEST',
  'CREATE_PROJECT',
  'VIEW_PROJECT',
  'UPDATE_PROJECT',
  'DELETE_PROJECT',
  'CREATE_PROJECT_UPDATE',
  'VIEW_USER',
  'CREATE_USER',
  'UPDATE_USER',
  'DELETE_USER',
  'VIEW_ROLE',
  'CREATE_ROLE',
  'UPDATE_ROLE',
  'DELETE_ROLE',
  'VIEW_PERMISSION',
  'CREATE_PERMISSION',
  'UPDATE_PERMISSION',
  'DELETE_PERMISSION',
  'VIEW_DEPARTMENT',
  'CREATE_DEPARTMENT',
  'UPDATE_DEPARTMENT',
  'DELETE_DEPARTMENT',
  'CREATE_PARCEL',
  'VIEW_PARCEL',
  'UPDATE_PARCEL',
  'RECEIVE_PARCEL',
  'CHANGE_PARCEL_STATUS',
  'VERIFY_PARCEL_PAYMENT',
  'VIEW_PARCEL_PAYMENT',
  'COLLECT_PARCEL',
  'VIEW_IDENTITY_DATA',
  'PRINT_PARCEL_RECEIPT',
];

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (transaction) => {
    const role = await transaction.role.upsert({
      where: { name: 'SUPER_ADMIN' },
      update: {},
      create: { name: 'SUPER_ADMIN' },
    });

    const department = await transaction.department.upsert({
      where: { type: 'VANGUARD_COACH' },
      update: {},
      create: { type: 'VANGUARD_COACH', name: 'Vanguard Coach' },
    });

    for (const permissionName of superAdminPermissionNames) {
      const permission = await transaction.permission.upsert({
        where: { name: permissionName },
        update: {},
        create: { name: permissionName },
      });

      await transaction.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }

    await transaction.user.upsert({
      where: { email },
      update: {
        passwordHash,
        roleId: role.id,
        departmentId: department.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
      create: {
        firstName: 'Super',
        lastName: 'Admin',
        email,
        passwordHash,
        roleId: role.id,
        departmentId: department.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
    });
  });

  console.log(`Super Admin bootstrap completed for ${email}.`);
}

main()
  .catch((error) => {
    const message = error.message.startsWith('Missing required environment variables:')
      || error.message === 'DATABASE_URL must not be empty'
      || error.message === 'SUPER_ADMIN_EMAIL must not be empty'
      || error.message === 'SUPER_ADMIN_PASSWORD must not be empty'
      ? error.message
      : 'Database operation could not be completed.';
    console.error(`Super Admin bootstrap failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
