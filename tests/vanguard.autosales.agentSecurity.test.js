const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const http = require('http');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const { main: seedMain } = require('../prisma/seed');

let server;
let baseUrl;
let adminToken;
const createdUsers = [];
const createdVehicles = [];
const createdReservations = [];
const createdPayments = [];

async function request(method, path, body, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof Buffer)) headers['Content-Type'] = 'application/json';

  const options = { method, headers };
  if (body !== undefined && body !== null) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { status: res.status, data };
}

async function ensurePermissions(roleName, permissionNames) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) throw new Error(`Role not found: ${roleName}`);

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

async function createUser({ email, password, firstName, lastName, roleName, departmentType }) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  const department = await prisma.department.findUnique({ where: { type: departmentType } });
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      firstName,
      lastName,
      phone: '0700000000',
      roleId: role.id,
      departmentId: department.id,
      status: 'ACTIVE',
      firstLogin: true,
    },
  });
  createdUsers.push(user.id);
  return user;
}

async function login(email, password) {
  const response = await request('POST', '/api/auth/login', { identifier: email, password });
  assert.equal(response.status, 200);
  return response.data.data.token;
}

test.before(async () => {
  await seedMain();
  await ensurePermissions('SALES_AGENT', [
    'VIEW_VEHICLE_INQUIRY',
    'UPDATE_VEHICLE_INQUIRY',
    'ASSIGN_VEHICLE_INQUIRY',
    'VIEW_RESERVATION',
    'MANAGE_VEHICLE_RESERVATION',
    'CANCEL_VEHICLE_RESERVATION',
  ]);

  server = http.createServer(app);
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve())));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  const loginRes = await request('POST', '/api/auth/login', {
    identifier: 'admin@vanguard.local',
    password: 'Admin123!',
  });
  assert.equal(loginRes.status, 200, 'Admin login should succeed');
  adminToken = loginRes.data.data.token;
});

test.after(async () => {
  for (const paymentId of createdPayments) {
    await prisma.payment.deleteMany({ where: { id: paymentId } });
  }
  for (const reservationId of createdReservations) {
    await prisma.vehicleReservation.deleteMany({ where: { id: reservationId } });
  }
  for (const vehicleId of createdVehicles) {
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
  }
  for (const userId of createdUsers) {
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('SALES_AGENT must receive the permissions required by the AutoSales agent workspace', async () => {
  const salesAgentRole = await prisma.role.findUnique({
    where: { name: 'SALES_AGENT' },
    include: { permissions: { include: { permission: true } } },
  });

  const permissionNames = salesAgentRole.permissions.map(({ permission }) => permission.name);
  assert.ok(permissionNames.includes('VIEW_VEHICLE_INQUIRY'));
  assert.ok(permissionNames.includes('UPDATE_VEHICLE_INQUIRY'));
  assert.ok(permissionNames.includes('VIEW_RESERVATION'));
  assert.ok(permissionNames.includes('MANAGE_VEHICLE_RESERVATION'));
});

test('SALES_AGENT can access only its own reservations and payments', async () => {
  const departmentsRes = await request('GET', '/api/departments', null, adminToken);
  assert.equal(departmentsRes.status, 200);
  const department = departmentsRes.data.data.items.find((item) => item.type === 'AUTO_SALES');
  assert.ok(department, 'AUTO_SALES department is required');

  const firstAgent = await createUser({
    email: `agent1.${Date.now()}@example.com`,
    password: 'AgentPass123!',
    firstName: 'Agent',
    lastName: 'One',
    roleName: 'SALES_AGENT',
    departmentType: 'AUTO_SALES',
  });

  const secondAgent = await createUser({
    email: `agent2.${Date.now()}@example.com`,
    password: 'AgentPass123!',
    firstName: 'Agent',
    lastName: 'Two',
    roleName: 'SALES_AGENT',
    departmentType: 'AUTO_SALES',
  });

  const vehicleRes = await request('POST', '/api/vehicles', {
    departmentId: department.id,
    brand: 'Security',
    model: 'AgentGuard',
    year: 2024,
    mileage: 1000,
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    price: '24500.00',
    description: 'Security isolation vehicle',
  }, adminToken);
  assert.equal(vehicleRes.status, 201);
  const vehicleId = vehicleRes.data.data.vehicle.id;
  createdVehicles.push(vehicleId);

  const firstAgentToken = await login(firstAgent.email, 'AgentPass123!');
  const secondAgentToken = await login(secondAgent.email, 'AgentPass123!');

  const reservationDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const expirationDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const createReservationRes = await request('POST', '/api/vehicle-reservations', {
    vehicleId,
    customerName: 'Owner Customer',
    customerPhone: '0600000001',
    customerEmail: 'owner@example.com',
    reservationAmount: '24500.00',
    depositAmount: '1000.00',
    reservationDate,
    expirationDate,
  }, firstAgentToken);
  assert.equal(createReservationRes.status, 201);
  const reservation = createReservationRes.data.data.vehicleReservation;
  createdReservations.push(reservation.id);

  const ownReservationRes = await request('GET', `/api/vehicle-reservations/${reservation.id}`, null, firstAgentToken);
  assert.equal(ownReservationRes.status, 200);

  const otherAgentReservationRes = await request('GET', `/api/vehicle-reservations/${reservation.id}`, null, secondAgentToken);
  assert.equal(otherAgentReservationRes.status, 403);

  const createPaymentRes = await request('POST', '/api/vehicle-payments', {
    reservationId: reservation.id,
    amount: '5000.00',
    method: 'CASH',
    reference: 'AUTOSEC-1',
  }, firstAgentToken);
  assert.equal(createPaymentRes.status, 201);
  const payment = createPaymentRes.data.data.payment;
  createdPayments.push(payment.id);

  const ownPaymentRes = await request('GET', `/api/vehicle-payments/reservation/${reservation.id}`, null, firstAgentToken);
  assert.equal(ownPaymentRes.status, 200);

  const otherAgentPaymentRes = await request('GET', `/api/vehicle-payments/reservation/${reservation.id}`, null, secondAgentToken);
  assert.equal(otherAgentPaymentRes.status, 403);

  const otherAgentValidateRes = await request('POST', `/api/vehicle-payments/${payment.id}/validate`, null, secondAgentToken);
  assert.equal(otherAgentValidateRes.status, 403);

  const otherAgentRejectRes = await request('POST', `/api/vehicle-payments/${payment.id}/reject`, { reason: 'invalid' }, secondAgentToken);
  assert.equal(otherAgentRejectRes.status, 403);
});
