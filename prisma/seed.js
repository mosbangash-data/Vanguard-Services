require('dotenv').config();

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = (process.env.DATABASE_URL || '').replace(/^['"]|['"]$/g, '');
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const languages = [
    { code: 'FR', name: 'Français' },
    { code: 'EN', name: 'English' },
  ];

  for (const language of languages) {
    await prisma.language.upsert({
      where: { code: language.code },
      update: {},
      create: language,
    });
  }

  const departments = [
    { type: 'VANGUARD_COACH', name: 'Vanguard Coach' },
    { type: 'CONSTRUCTION', name: 'Construction' },
    { type: 'AUTO_SALES', name: 'Auto Sales' },
  ];

  for (const department of departments) {
    await prisma.department.upsert({
      where: { type: department.type },
      update: {},
      create: department,
    });
  }

  const roleNames = ['SUPER_ADMIN', 'SERVICE_ADMIN', 'MANAGER', 'AGENT', 'ENGINEER', 'CONSTRUCTION', 'SALES_AGENT'];
  for (const roleName of roleNames) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  const permissions = [
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
  ];

  for (const permissionName of permissions) {
    await prisma.permission.upsert({
      where: { name: permissionName },
      update: {},
      create: { name: permissionName },
    });
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
  ];

  const constructionPermissionNames = [
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
  ];

  const rolePermissions = {
    SUPER_ADMIN: superAdminPermissionNames,
    SERVICE_ADMIN: [
      'CREATE_RESERVATION', 'VIEW_RESERVATION', 'UPDATE_RESERVATION', 'CANCEL_VEHICLE_RESERVATION', 'MANAGE_RESERVATION_PAYMENT',
      'VIEW_TRIP', 'VIEW_PAYMENT', 'VIEW_OCCUPANCY',
      'VIEW_VEHICLE', 'CREATE_VEHICLE', 'UPDATE_VEHICLE', 'DELETE_VEHICLE', 'MANAGE_VEHICLE_MEDIA',
      'VIEW_VEHICLE_INQUIRY', 'CREATE_VEHICLE_INQUIRY', 'UPDATE_VEHICLE_INQUIRY', 'ASSIGN_VEHICLE_INQUIRY', 'CLOSE_VEHICLE_INQUIRY', 'MANAGE_VEHICLE_INQUIRY', 'MANAGE_VEHICLE_RESERVATION',
      'CREATE_CUSTOMER_REQUEST', 'VIEW_CUSTOMER_REQUEST', 'UPDATE_CUSTOMER_REQUEST', 'CREATE_QUOTE_REQUEST', 'VIEW_QUOTE_REQUEST', 'UPDATE_QUOTE_REQUEST',
      'CREATE_PROJECT', 'VIEW_PROJECT', 'UPDATE_PROJECT', 'DELETE_PROJECT',
    ],
    AGENT: [
      'CREATE_RESERVATION', 'VIEW_RESERVATION', 'UPDATE_RESERVATION', 'MANAGE_RESERVATION_PAYMENT',
      'VIEW_TRIP', 'VIEW_PAYMENT', 'SCAN_TICKET', 'VIEW_TICKET_SCAN',
      'VIEW_VEHICLE', 'VIEW_VEHICLE_INQUIRY', 'CREATE_VEHICLE_INQUIRY', 'UPDATE_VEHICLE_INQUIRY',
      'VIEW_CUSTOMER_REQUEST', 'UPDATE_CUSTOMER_REQUEST', 'VIEW_QUOTE_REQUEST',
    ],
    MANAGER: [
      'VIEW_RESERVATION', 'VIEW_TRIP', 'VIEW_PAYMENT', 'VIEW_OCCUPANCY', 'VIEW_TICKET_SCAN',
    ],
    ENGINEER: ['VIEW_PROJECT', 'UPDATE_PROJECT', 'CREATE_PROJECT_UPDATE'],
    CONSTRUCTION: constructionPermissionNames,
    SALES_AGENT: [
      'VIEW_VEHICLE_INQUIRY',
      'UPDATE_VEHICLE_INQUIRY',
      'ASSIGN_VEHICLE_INQUIRY',
      'VIEW_RESERVATION',
      'MANAGE_VEHICLE_RESERVATION',
      'CANCEL_VEHICLE_RESERVATION',
    ],
  };

  await prisma.rolePermission.deleteMany();

  for (const [roleName, permissionNames] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;
    for (const permissionName of permissionNames) {
      const permission = await prisma.permission.findUnique({ where: { name: permissionName } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  // Cleanup domain data so tests run deterministically.
  // Remove child records first to avoid RESTRICT FK errors, then parent domain records.
  await prisma.ticketScan.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.vehicleReservationCancellation.deleteMany();
  await prisma.vehicleReservation.deleteMany();
  await prisma.vehicleInquiry.deleteMany();
  await prisma.vehicleMedia.deleteMany();
  await prisma.vehicleTranslation.deleteMany();
  await prisma.vehicle.deleteMany();

  await prisma.schedule.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.route.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.agency.deleteMany();

  await prisma.projectUpdateTranslation.deleteMany();
  await prisma.projectUpdate.deleteMany();
  await prisma.projectGallery.deleteMany();
  await prisma.projectTranslation.deleteMany();
  await prisma.projectAssignment.deleteMany();
  await prisma.project.deleteMany();

  await prisma.quoteRequest.deleteMany();
  await prisma.customerRequest.deleteMany();

  await prisma.notificationTemplateTranslation.deleteMany();
  await prisma.notificationTemplate.deleteMany();
  await prisma.notification.deleteMany();

  await prisma.parcel.deleteMany();

  // Cleanup any non-seeded users to keep test runs deterministic.
  // We keep the seeded admin and construction accounts and remove others.
  const seededEmails = ['admin@vanguard.local', 'construction@vanguard.local', 'engineer.a@vanguard.local', 'engineer.b@vanguard.local'];
  await prisma.user.deleteMany({ where: { email: { notIn: seededEmails } } });

  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@vanguard.local';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'dev-super-admin-password';
  if (!process.env.SUPER_ADMIN_PASSWORD && process.env.NODE_ENV === 'production') {
    throw new Error('SUPER_ADMIN_PASSWORD must be set in production');
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const department = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
    const role = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });

    if (department && role) {
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          firstName: 'Super',
          lastName: 'Admin',
          phone: '+33000000000',
          roleId: role.id,
          departmentId: department.id,
          status: 'ACTIVE',
        },
      });
    }
  } else {
    const department = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
    const role = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });

    if (department && role) {
      await prisma.user.update({
        where: { email: adminEmail },
        data: {
          roleId: role.id,
          departmentId: department.id,
          status: 'ACTIVE',
        },
      });
    }
  }

  const constructionEmail = 'construction@vanguard.local';
  const constructionPassword = process.env.CONSTRUCTION_SEED_PASSWORD || 'dev-construction-password';
  const department = await prisma.department.findUnique({ where: { type: 'CONSTRUCTION' } });
  const role = await prisma.role.findUnique({ where: { name: 'CONSTRUCTION' } });

  if (department && role) {
    const existingConstructionUser = await prisma.user.findUnique({ where: { email: constructionEmail } });

    if (!existingConstructionUser) {
      const passwordHash = await bcrypt.hash(constructionPassword, 10);

      await prisma.user.create({
        data: {
          email: constructionEmail,
          passwordHash,
          firstName: 'Construction',
          lastName: 'User',
          phone: '+33000000001',
          roleId: role.id,
          departmentId: department.id,
          status: 'ACTIVE',
          firstLogin: false,
        },
      });
    } else if (existingConstructionUser.roleId !== role.id || existingConstructionUser.departmentId !== department.id) {
      await prisma.user.update({
        where: { email: constructionEmail },
        data: {
          roleId: role.id,
          departmentId: department.id,
          status: 'ACTIVE',
          firstLogin: false,
        },
      });
    }
  }

  const engineerRole = await prisma.role.findUnique({ where: { name: 'ENGINEER' } });
  if (department && engineerRole) {
    const engineers = [
      { email: 'engineer.a@vanguard.local', firstName: 'Engineer', lastName: 'A', password: process.env.ENGINEER_A_SEED_PASSWORD || 'dev-engineer-a-password' },
      { email: 'engineer.b@vanguard.local', firstName: 'Engineer', lastName: 'B', password: process.env.ENGINEER_B_SEED_PASSWORD || 'dev-engineer-b-password' },
    ];

    const savedEngineers = [];
    for (const engineer of engineers) {
      const passwordHash = await bcrypt.hash(engineer.password, 10);
      savedEngineers.push(await prisma.user.upsert({
        where: { email: engineer.email },
        update: { firstName: engineer.firstName, lastName: engineer.lastName, passwordHash, roleId: engineerRole.id, departmentId: department.id, status: 'ACTIVE', firstLogin: false },
        create: { email: engineer.email, firstName: engineer.firstName, lastName: engineer.lastName, passwordHash, roleId: engineerRole.id, departmentId: department.id, status: 'ACTIVE', firstLogin: false },
      }));
    }

    const projects = [
      { title: 'Chantier Engineer A', slug: 'engineer-a-site', location: 'Site A', description: 'Chantier attribué à Engineer A.' },
      { title: 'Chantier Engineer B', slug: 'engineer-b-site', location: 'Site B', description: 'Chantier attribué à Engineer B.' },
    ];

    for (let index = 0; index < projects.length; index += 1) {
      const project = await prisma.project.upsert({
        where: { slug: projects[index].slug },
        update: { ...projects[index], departmentId: department.id, status: 'PUBLISHED', publicationStatus: 'PUBLISHED' },
        create: { ...projects[index], departmentId: department.id, status: 'PUBLISHED', publicationStatus: 'PUBLISHED' },
      });
      await prisma.projectAssignment.upsert({
        where: {
          projectId_userId: {
            projectId: project.id,
            userId: savedEngineers[index].id,
          },
        },
        update: {},
        create: {
          projectId: project.id,
          userId: savedEngineers[index].id,
        },
      });
    }
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { main };
