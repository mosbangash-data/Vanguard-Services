const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const { main: seedMain } = require('../prisma/seed');
const prisma = require('../src/config/prisma');

let server;
let baseUrl;
let adminToken;

async function request(method, path, body, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof Buffer)) headers['Content-Type'] = 'application/json';

  const options = { method, headers };
  if (body !== undefined && body !== null) options.body = typeof body === 'string' ? body : JSON.stringify(body);

  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { status: res.status, data };
}

async function login(email, password) {
  const response = await request('POST', '/api/auth/login', { identifier: email, password });
  assert.equal(response.status, 200);
  return response.data.data.token;
}

function createUniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.before(async () => {
  await seedMain();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  adminToken = await login('admin@vanguard.local', 'Admin123!');
});

test.after(async () => {
  await prisma.payment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.ticketScan.deleteMany();
  await prisma.vehicleReservation.deleteMany();
  await prisma.vehicleInquiry.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.project.deleteMany();
  await prisma.quoteRequest.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.route.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.user.deleteMany({ where: { email: { contains: 'dashboard' } } });
  await prisma.serviceSettings.deleteMany();
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('construction department user can access department overview using real backend status keys', async () => {
  const constructionDepartment = await prisma.department.findUnique({ where: { type: 'CONSTRUCTION' } });
  const constructionUser = await prisma.user.findUnique({ where: { email: 'construction@vanguard.local' } });
  assert.ok(constructionDepartment, 'Construction department should exist');
  assert.ok(constructionUser, 'Construction test user should exist');

  await prisma.project.create({
    data: {
      departmentId: constructionDepartment.id,
      title: 'Construction Dashboard Test Project',
      location: 'Lyon',
      description: 'Regression dashboard project',
      status: 'PUBLISHED',
      publicationStatus: 'PUBLISHED',
    },
  });

  const constructionToken = await login('construction@vanguard.local', 'Construction123!');
  const response = await request('GET', '/api/dashboard/overview', null, constructionToken);
  assert.equal(response.status, 200, 'Construction user should access dashboard overview');
  assert.ok(response.data?.data?.construction?.projects, 'Construction dashboard payload should include project stats');
  assert.ok(Object.hasOwn(response.data.data.construction.projects, 'DRAFT'), 'Construction projects should use real backend status keys');
  assert.ok(Object.hasOwn(response.data.data.construction.projects, 'PUBLISHED'), 'Construction projects should use real backend status keys');
  assert.ok(Object.hasOwn(response.data.data.construction.projects, 'ARCHIVED'), 'Construction projects should use real backend status keys');
  assert.equal(response.data.data.department, 'CONSTRUCTION');
});

test('dashboard overview returns real multiservice aggregates for super admin', async () => {
  const coachDepartment = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  const constructionDepartment = await prisma.department.findUnique({ where: { type: 'CONSTRUCTION' } });
  const autoSalesDepartment = await prisma.department.findUnique({ where: { type: 'AUTO_SALES' } });

  await prisma.serviceSettings.upsert({
    where: { departmentId: coachDepartment.id },
    update: { currency: 'USD' },
    create: { departmentId: coachDepartment.id, currency: 'USD' },
  });

  const route = await prisma.route.create({
    data: {
      departmentId: coachDepartment.id,
      code: `DASH-${Date.now()}`,
      departureCity: 'Paris',
      arrivalCity: 'Lyon',
      status: 'ACTIVE',
    },
  });

  const bus = await prisma.bus.create({
    data: {
      departmentId: coachDepartment.id,
      plateNumber: `DB-${Date.now()}`,
      brand: 'Mercedes',
      model: 'Tourismo',
      seats: 40,
      status: 'ACTIVE',
    },
  });

  const schedule = await prisma.schedule.create({
    data: {
      departmentId: coachDepartment.id,
      routeId: route.id,
      busId: bus.id,
      departureTime: '08:00',
      availableDays: ['MON'],
      price: '42.00',
      status: 'ACTIVE',
    },
  });

  const trip = await prisma.trip.create({
    data: {
      scheduleId: schedule.id,
      departureAt: new Date(Date.now() + 3600_000),
      arrivalAt: new Date(Date.now() + 3_600_000 + 60_000),
      status: 'SCHEDULED',
    },
  });

  const reservation = await prisma.reservation.create({
    data: {
      reservationCode: `TR-${Date.now()}`,
      tripId: trip.id,
      customerName: 'Dashboard Visitor',
      customerPhone: '0101010101',
      customerEmail: 'dashboard@example.com',
      seatNumber: '1',
      totalAmount: '42.00',
      status: 'CONFIRMED',
    },
  });

  await prisma.ticket.create({
    data: {
      ticketCode: `TKT-${Date.now()}`,
      reservationId: reservation.id,
      qrCode: `QR-${Date.now()}`,
      serialNumber: `SER-${Date.now()}`,
      status: 'VALID',
    },
  });

  await prisma.payment.create({
    data: {
      reservationId: reservation.id,
      amount: '42.00',
      method: 'CASH',
      status: 'VERIFIED',
      reference: `DASH-TR-${Date.now()}`,
    },
  });

  const project = await prisma.project.create({
    data: {
      departmentId: constructionDepartment.id,
      title: 'Dashboard Construction Project',
      location: 'Paris',
      description: 'Dashboard test project',
      status: 'PUBLISHED',
      publicationStatus: 'PUBLISHED',
    },
  });

  await prisma.quoteRequest.create({
    data: {
      departmentId: constructionDepartment.id,
      customerName: 'Quote Client',
      customerEmail: 'quote@example.com',
      customerPhone: '0202020202',
      description: 'Dashboard quote request',
      status: 'NEW',
    },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      departmentId: autoSalesDepartment.id,
      brand: 'Dashboard',
      model: 'Car',
      year: 2025,
      mileage: 10,
      fuelType: 'Gasoline',
      transmission: 'Automatic',
      color: 'Blue',
      price: '25000.00',
      currency: 'USD',
      status: 'SOLD',
      description: 'Dashboard sale vehicle',
    },
  });

  const inquiry = await prisma.vehicleInquiry.create({
    data: {
      vehicleId: vehicle.id,
      customerName: 'AutoBuyer',
      customerPhone: '0303030303',
      customerEmail: 'buyer@example.com',
      inquiryType: 'PRICE_REQUEST',
      message: 'Dashboard inquiry',
      status: 'CONVERTED',
    },
  });

  const vehicleReservation = await prisma.vehicleReservation.create({
    data: {
      reservationCode: `VR-${Date.now()}`,
      vehicleId: vehicle.id,
      customerName: 'AutoBuyer',
      customerPhone: '0303030303',
      customerEmail: 'buyer@example.com',
      status: 'COMPLETED',
      reservationAmount: '25000.00',
      paymentStatus: 'COMPLETED',
      reservationDate: new Date(),
    },
  });

  await prisma.payment.create({
    data: {
      vehicleReservationId: vehicleReservation.id,
      amount: '25000.00',
      method: 'BANK_TRANSFER',
      status: 'VERIFIED',
      reference: `AUTO-${Date.now()}`,
    },
  });

  const dashboardResponse = await request('GET', '/api/dashboard/overview', null, adminToken);
  assert.equal(dashboardResponse.status, 200);

  const data = dashboardResponse.data.data;
  assert.ok(data.global);
  assert.ok(data.transport);
  assert.ok(data.construction);
  assert.ok(data.autoSales);
  assert.ok(data.revenue);
  assert.ok(Array.isArray(data.recentActivity));
  assert.ok(data.transport.trips.total >= 1);
  assert.ok(data.construction.projects.PUBLISHED >= 1);
  assert.ok(data.autoSales.vehicles.SOLD >= 1);
  assert.ok(data.autoSales.inquiries.CONVERTED >= 1);
  assert.ok(typeof data.revenue.USD === 'number');
  assert.ok(typeof data.revenue.CDF === 'number');
  assert.equal(data.transport.revenue.USD, 42);
  assert.equal(data.autoSales.revenue.USD, 25000);

  const projectStatus = await prisma.project.findUnique({ where: { id: project.id } });
  assert.equal(projectStatus.status, 'PUBLISHED');
  assert.equal(inquiry.status, 'CONVERTED');
  assert.equal(vehicleReservation.status, 'COMPLETED');
});

test('dashboard overview restricts non-super-admin access to local scope and rejects unauthorized roles', async () => {
  const serviceAdminDepartment = await prisma.department.findUnique({ where: { type: 'CONSTRUCTION' } });
  const serviceAdminEmail = `dashboard-service-admin-${Date.now()}@example.com`;
  const serviceAdminPassword = 'ServiceAdmin123!';

  const serviceAdminRole = await prisma.role.findUnique({ where: { name: 'SERVICE_ADMIN' } });
  await prisma.user.create({
    data: {
      email: serviceAdminEmail,
      passwordHash: await bcrypt.hash(serviceAdminPassword, 10),
      firstName: 'Dashboard',
      lastName: 'ServiceAdmin',
      phone: '+33000000088',
      roleId: serviceAdminRole.id,
      departmentId: serviceAdminDepartment.id,
      status: 'ACTIVE',
      firstLogin: false,
    },
  });

  const serviceAdminToken = await login(serviceAdminEmail, serviceAdminPassword);
  const serviceAdminResponse = await request('GET', '/api/dashboard/overview', null, serviceAdminToken);
  assert.equal(serviceAdminResponse.status, 200);
  assert.equal(serviceAdminResponse.data.data.department, 'CONSTRUCTION');
  assert.ok(serviceAdminResponse.data.data.construction);

  const agentEmail = `dashboard-agent-${Date.now()}@example.com`;
  const agentUser = await prisma.user.create({
    data: {
      email: agentEmail,
      passwordHash: await bcrypt.hash('AgentPass123!', 10),
      firstName: 'Dashboard',
      lastName: 'Agent',
      phone: '+33000000099',
      roleId: (await prisma.role.findUnique({ where: { name: 'AGENT' } })).id,
      departmentId: serviceAdminDepartment.id,
      status: 'ACTIVE',
      firstLogin: false,
    },
  });

  const agentToken = await login(agentEmail, 'AgentPass123!');
  const agentResponse = await request('GET', '/api/dashboard/overview', null, agentToken);
  assert.equal(agentResponse.status, 403);

  const unauthenticatedResponse = await request('GET', '/api/dashboard/overview', null, null);
  assert.equal(unauthenticatedResponse.status, 401);

  await prisma.user.delete({ where: { id: agentUser.id } });
});
