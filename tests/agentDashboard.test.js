const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const { main: seedMain } = require('../prisma/seed');

let server;
let baseUrl;
let adminToken;
let agentToken;
let noAgencyToken;
let limitedToken;
const createdIds = {
  users: [],
  roles: [],
  agencies: [],
  buses: [],
  routes: [],
  schedules: [],
  trips: [],
  reservations: [],
  payments: [],
};

async function request(method, path, body, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined || body === null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

async function login(email, password) {
  const response = await request('POST', '/api/auth/login', { identifier: email, password });
  assert.equal(response.status, 200);
  return response.data.data.token;
}

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createUser({ email, roleId, departmentId, agencyId = null, password = 'Test123!' }) {
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      firstName: 'Dashboard',
      lastName: 'Test',
      roleId,
      departmentId,
      agencyId,
      status: 'ACTIVE',
      firstLogin: false,
    },
  });
  createdIds.users.push(user.id);
  return { email, password };
}

test.before(async () => {
  await seedMain();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  adminToken = await login('admin@vanguard.local', 'Admin123!');
  agentToken = await login('coach.agent@vanguard.local', process.env.COACH_AGENT_PASSWORD || 'dev-coach-agent-password');

  const department = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  const agentRole = await prisma.role.findUnique({ where: { name: 'AGENT' } });
  const noAgencyUser = await createUser({ email: id('agent-no-agency') + '@example.test', roleId: agentRole.id, departmentId: department.id });
  noAgencyToken = await login(noAgencyUser.email, noAgencyUser.password);

  const limitedRole = await prisma.role.create({ data: { name: id('LIMITED_AGENT') } });
  createdIds.roles.push(limitedRole.id);
  const limitedUser = await createUser({ email: id('agent-limited') + '@example.test', roleId: limitedRole.id, departmentId: department.id });
  limitedToken = await login(limitedUser.email, limitedUser.password);
});

test.after(async () => {
  await prisma.payment.deleteMany({ where: { id: { in: createdIds.payments } } });
  await prisma.reservation.deleteMany({ where: { id: { in: createdIds.reservations } } });
  await prisma.trip.deleteMany({ where: { id: { in: createdIds.trips } } });
  await prisma.schedule.deleteMany({ where: { id: { in: createdIds.schedules } } });
  await prisma.route.deleteMany({ where: { id: { in: createdIds.routes } } });
  await prisma.bus.deleteMany({ where: { id: { in: createdIds.buses } } });
  await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
  await prisma.role.deleteMany({ where: { id: { in: createdIds.roles } } });
  await prisma.agency.deleteMany({ where: { id: { in: createdIds.agencies } } });
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

async function createAgencyAndTrip({ departmentId, agencyId, suffix }) {
  const route = await prisma.route.create({
    data: {
      departmentId,
      code: id(`ROUTE-${suffix}`),
      departureCity: 'Kinshasa',
      arrivalCity: 'Matadi',
      status: 'ACTIVE',
    },
  });
  createdIds.routes.push(route.id);
  const bus = await prisma.bus.create({
    data: {
      departmentId,
      plateNumber: id(`BUS-${suffix}`),
      brand: 'Coach',
      model: 'Test',
      seats: 40,
      status: 'ACTIVE',
    },
  });
  createdIds.buses.push(bus.id);
  const schedule = await prisma.schedule.create({
    data: {
      departmentId,
      routeId: route.id,
      busId: bus.id,
      agencyId,
      departureTime: '08:00',
      availableDays: ['MON'],
      price: '20.00',
      status: 'ACTIVE',
    },
  });
  createdIds.schedules.push(schedule.id);
  const trip = await prisma.trip.create({
    data: {
      scheduleId: schedule.id,
      departureAt: new Date(Date.now() + 60 * 60 * 1000),
      arrivalAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      status: 'SCHEDULED',
    },
  });
  createdIds.trips.push(trip.id);
  return trip;
}

test('Agent dashboard returns scoped operational data and occupancy from persisted reservations', async () => {
  const department = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  const agent = await prisma.user.findUnique({ where: { email: 'coach.agent@vanguard.local' } });
  const agencyB = await prisma.agency.create({ data: { departmentId: department.id, code: id('AGENCY-B'), name: 'Agency B', city: 'Matadi' } });
  createdIds.agencies.push(agencyB.id);
  const tripA = await createAgencyAndTrip({ departmentId: department.id, agencyId: agent.agencyId, suffix: 'A' });
  const tripB = await createAgencyAndTrip({ departmentId: department.id, agencyId: agencyB.id, suffix: 'B' });

  const reservationA = await prisma.reservation.create({
    data: {
      reservationCode: id('RSV-A'), tripId: tripA.id, agencyId: agent.agencyId,
      customerName: 'Agency A Passenger', customerPhone: '0800000001', seatNumber: '1',
      totalAmount: '20.00', status: 'PENDING',
    },
  });
  createdIds.reservations.push(reservationA.id);
  const reservationB = await prisma.reservation.create({
    data: {
      reservationCode: id('RSV-B'), tripId: tripB.id, agencyId: agencyB.id,
      customerName: 'Agency B Passenger', customerPhone: '0800000002', seatNumber: '1',
      totalAmount: '20.00', status: 'PENDING',
    },
  });
  createdIds.reservations.push(reservationB.id);
  const payment = await prisma.payment.create({
    data: { reservationId: reservationA.id, amount: '20.00', currency: 'USD', channel: 'AGENCY', method: 'CASH', status: 'PENDING' },
  });
  createdIds.payments.push(payment.id);

  const response = await request('GET', '/api/agent/dashboard', null, agentToken);
  assert.equal(response.status, 200);
  assert.equal(response.data.success, true);
  assert.equal(response.data.data.overview.todayTrips, 1);
  assert.equal(response.data.data.overview.pendingPayments, 1);
  assert.equal(response.data.data.departures.today[0].seatsReserved, 1);
  assert.equal(response.data.data.departures.today[0].seatsRemaining, 39);
  assert.equal(response.data.data.reservations.some((item) => item.id === reservationA.id), true);
  assert.equal(response.data.data.reservations.some((item) => item.id === reservationB.id), false);
  assert.equal(response.data.data.payments.pending[0].id, payment.id);
});

test('Agent without agency is rejected by the dashboard endpoint', async () => {
  const response = await request('GET', '/api/agent/dashboard', null, noAgencyToken);
  assert.equal(response.status, 403);
});

test('Users without dashboard permissions are rejected', async () => {
  const response = await request('GET', '/api/agent/dashboard', null, limitedToken);
  assert.equal(response.status, 403);
});

test('Super admin can access the Coach dashboard endpoint', async () => {
  const response = await request('GET', '/api/agent/dashboard', null, adminToken);
  assert.equal(response.status, 200);
  assert.equal(response.data.success, true);
});

test('Unauthenticated dashboard requests return 401', async () => {
  const response = await request('GET', '/api/agent/dashboard');
  assert.equal(response.status, 401);
});
