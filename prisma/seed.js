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

  const roleNames = ['SUPER_ADMIN', 'SERVICE_ADMIN', 'MANAGER', 'AGENT'];
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
    'CREATE_PROJECT_UPDATE',
    'VIEW_USER',
  ];

  const rolePermissions = {
    SUPER_ADMIN: superAdminPermissionNames,
    SERVICE_ADMIN: [
      'CREATE_RESERVATION', 'VIEW_RESERVATION', 'UPDATE_RESERVATION', 'CANCEL_VEHICLE_RESERVATION', 'MANAGE_RESERVATION_PAYMENT',
      'VIEW_TRIP', 'VIEW_PAYMENT', 'VIEW_OCCUPANCY', 'SCAN_TICKET', 'VIEW_TICKET_SCAN',
      'VIEW_VEHICLE', 'CREATE_VEHICLE', 'UPDATE_VEHICLE', 'DELETE_VEHICLE', 'MANAGE_VEHICLE_MEDIA',
      'VIEW_VEHICLE_INQUIRY', 'CREATE_VEHICLE_INQUIRY', 'UPDATE_VEHICLE_INQUIRY', 'ASSIGN_VEHICLE_INQUIRY', 'CLOSE_VEHICLE_INQUIRY', 'MANAGE_VEHICLE_INQUIRY', 'MANAGE_VEHICLE_RESERVATION',
      'CREATE_CUSTOMER_REQUEST', 'VIEW_CUSTOMER_REQUEST', 'UPDATE_CUSTOMER_REQUEST', 'CREATE_QUOTE_REQUEST', 'VIEW_QUOTE_REQUEST', 'UPDATE_QUOTE_REQUEST',
      'CREATE_PROJECT', 'VIEW_PROJECT', 'UPDATE_PROJECT', 'DELETE_PROJECT', 'CREATE_PROJECT_UPDATE',
      'VIEW_USER',
      'CREATE_PARCEL', 'VIEW_PARCEL', 'UPDATE_PARCEL', 'RECEIVE_PARCEL', 'CHANGE_PARCEL_STATUS', 'VERIFY_PARCEL_PAYMENT', 'VIEW_PARCEL_PAYMENT', 'COLLECT_PARCEL', 'VIEW_IDENTITY_DATA', 'PRINT_PARCEL_RECEIPT',
    ],
    AGENT: [
      'CREATE_RESERVATION', 'VIEW_RESERVATION', 'UPDATE_RESERVATION', 'MANAGE_RESERVATION_PAYMENT',
      'VIEW_TRIP', 'VIEW_PAYMENT', 'SCAN_TICKET', 'VIEW_TICKET_SCAN',
      'VIEW_VEHICLE', 'VIEW_VEHICLE_INQUIRY', 'CREATE_VEHICLE_INQUIRY', 'UPDATE_VEHICLE_INQUIRY',
      'VIEW_CUSTOMER_REQUEST', 'UPDATE_CUSTOMER_REQUEST', 'VIEW_QUOTE_REQUEST',
      'CREATE_PARCEL', 'VIEW_PARCEL', 'RECEIVE_PARCEL', 'CHANGE_PARCEL_STATUS', 'COLLECT_PARCEL', 'PRINT_PARCEL_RECEIPT',
    ],
    MANAGER: [
      'VIEW_RESERVATION', 'VIEW_TRIP', 'VIEW_PAYMENT', 'VIEW_OCCUPANCY', 'VIEW_TICKET_SCAN', 'VIEW_USER',
      'CREATE_PARCEL', 'VIEW_PARCEL', 'UPDATE_PARCEL', 'RECEIVE_PARCEL', 'CHANGE_PARCEL_STATUS', 'VERIFY_PARCEL_PAYMENT', 'VIEW_PARCEL_PAYMENT', 'COLLECT_PARCEL', 'VIEW_IDENTITY_DATA', 'PRINT_PARCEL_RECEIPT',
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
  await prisma.parcelPickup.deleteMany();
  await prisma.parcelStatusHistory.deleteMany();
  await prisma.ticketScan.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.parcel.deleteMany();
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
  const seededEmails = [
    'admin@vanguard.local',
    'coach.admin@vanguard.local',
    'coach.manager@vanguard.local',
    'coach.agent@vanguard.local',
    'autosales.admin@vanguard.local',
    'construction@vanguard.local',
  ];
  await prisma.user.deleteMany({ where: { email: { notIn: seededEmails } } });

  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@vanguard.local';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'dev-super-admin-password';
  if (!process.env.SUPER_ADMIN_PASSWORD && process.env.NODE_ENV === 'production') {
    throw new Error('SUPER_ADMIN_PASSWORD must be set in production');
  }

  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  const serviceAdminRole = await prisma.role.findUnique({ where: { name: 'SERVICE_ADMIN' } });
  const managerRole = await prisma.role.findUnique({ where: { name: 'MANAGER' } });
  const agentRole = await prisma.role.findUnique({ where: { name: 'AGENT' } });
  const coachDept = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  const autoDept = await prisma.department.findUnique({ where: { type: 'AUTO_SALES' } });
  const constructionDept = await prisma.department.findUnique({ where: { type: 'CONSTRUCTION' } });

  // 1. Super Admin
  if (coachDept && superAdminRole) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        firstName: 'Super',
        lastName: 'Admin',
        roleId: superAdminRole.id,
        departmentId: coachDept.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
      create: {
        email: adminEmail,
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        phone: '+33000000000',
        roleId: superAdminRole.id,
        departmentId: coachDept.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
    });
  }

  // 2. Coach Admin
  if (coachDept && serviceAdminRole) {
    const coachAdminEmail = 'coach.admin@vanguard.local';
    const coachPassword = process.env.COACH_ADMIN_PASSWORD || 'dev-coach-admin-password';
    const passwordHash = await bcrypt.hash(coachPassword, 10);
    await prisma.user.upsert({
      where: { email: coachAdminEmail },
      update: {
        firstName: 'Coach',
        lastName: 'Admin',
        roleId: serviceAdminRole.id,
        departmentId: coachDept.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
      create: {
        email: coachAdminEmail,
        passwordHash,
        firstName: 'Coach',
        lastName: 'Admin',
        phone: '+33000000002',
        roleId: serviceAdminRole.id,
        departmentId: coachDept.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
    });
  }

  // 3. Coach Manager
  if (coachDept && managerRole) {
    const coachManagerEmail = 'coach.manager@vanguard.local';
    const coachManagerPassword = process.env.COACH_MANAGER_PASSWORD || 'dev-coach-manager-password';
    const passwordHash = await bcrypt.hash(coachManagerPassword, 10);
    await prisma.user.upsert({
      where: { email: coachManagerEmail },
      update: {
        firstName: 'Coach',
        lastName: 'Manager',
        roleId: managerRole.id,
        departmentId: coachDept.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
      create: {
        email: coachManagerEmail,
        passwordHash,
        firstName: 'Coach',
        lastName: 'Manager',
        phone: '+33000000004',
        roleId: managerRole.id,
        departmentId: coachDept.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
    });
  }

  // 4. Coach Agent
  if (coachDept && agentRole) {
    const coachAgentEmail = 'coach.agent@vanguard.local';
    const coachAgentPassword = process.env.COACH_AGENT_PASSWORD || 'dev-coach-agent-password';
    const passwordHash = await bcrypt.hash(coachAgentPassword, 10);
    await prisma.user.upsert({
      where: { email: coachAgentEmail },
      update: {
        firstName: 'Coach',
        lastName: 'Agent',
        roleId: agentRole.id,
        departmentId: coachDept.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
      create: {
        email: coachAgentEmail,
        passwordHash,
        firstName: 'Coach',
        lastName: 'Agent',
        phone: '+33000000005',
        roleId: agentRole.id,
        departmentId: coachDept.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
    });
  }

  // 5. Auto Sales Admin
  if (autoDept && serviceAdminRole) {
    const autoAdminEmail = 'autosales.admin@vanguard.local';
    const autoPassword = process.env.AUTOSALES_ADMIN_PASSWORD || 'dev-autosales-admin-password';
    const passwordHash = await bcrypt.hash(autoPassword, 10);
    await prisma.user.upsert({
      where: { email: autoAdminEmail },
      update: {
        firstName: 'AutoSales',
        lastName: 'Admin',
        roleId: serviceAdminRole.id,
        departmentId: autoDept.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
      create: {
        email: autoAdminEmail,
        passwordHash,
        firstName: 'AutoSales',
        lastName: 'Admin',
        phone: '+33000000003',
        roleId: serviceAdminRole.id,
        departmentId: autoDept.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
    });
  }

  // 6. Construction Admin
  if (constructionDept && serviceAdminRole) {
    const constructionEmail = 'construction@vanguard.local';
    const constructionPassword = process.env.CONSTRUCTION_SEED_PASSWORD || 'dev-construction-password';
    const passwordHash = await bcrypt.hash(constructionPassword, 10);
    await prisma.user.upsert({
      where: { email: constructionEmail },
      update: {
        firstName: 'Construction',
        lastName: 'User',
        roleId: serviceAdminRole.id,
        departmentId: constructionDept.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
      create: {
        email: constructionEmail,
        passwordHash,
        firstName: 'Construction',
        lastName: 'User',
        phone: '+33000000001',
        roleId: serviceAdminRole.id,
        departmentId: constructionDept.id,
        status: 'ACTIVE',
        firstLogin: false,
      },
    });
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
