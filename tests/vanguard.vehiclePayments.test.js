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
let createdVehicleIds = [];
let createdReservationIds = [];
let createdPaymentIds = [];
let createdUserIds = [];
let createdRolePermissionIds = [];

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

test.before(async () => {
  await seedMain();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  const loginRes = await request('POST', '/api/auth/login', {
    identifier: 'admin@vanguard.local',
    password: 'Admin123!',
  });
  assert.equal(loginRes.status, 200);
  adminToken = loginRes.data.data.token;
});

const createTestUser = async ({ email, password, firstName, lastName, roleName, departmentType, permissions = [] }) => {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  const department = await prisma.department.findUnique({ where: { type: departmentType } });
  if (!role) throw new Error(`Role not found: ${roleName}`);
  if (!department) throw new Error(`Department not found: ${departmentType}`);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      phone: '0700000000',
      roleId: role.id,
      departmentId: department.id,
      status: 'ACTIVE',
      firstLogin: true,
    },
  });

  createdUserIds.push(user.id);

  for (const permissionName of permissions) {
    const permission = await prisma.permission.findUnique({ where: { name: permissionName } });
    if (permission) {
      const existing = await prisma.rolePermission.findFirst({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (!existing) {
        const rolePermission = await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
        createdRolePermissionIds.push(rolePermission.id);
      }
    }
  }

  return user;
};

const loginTestUser = async (email, password) => {
  const loginRes = await request('POST', '/api/auth/login', {
    identifier: email,
    password,
  });
  assert.equal(loginRes.status, 200);
  return loginRes.data.data.token;
};

test.after(async () => {
  if (createdPaymentIds.length) {
    await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
  }
  if (createdReservationIds.length) {
    await prisma.vehicleReservation.deleteMany({ where: { id: { in: createdReservationIds } } });
  }
  if (createdVehicleIds.length) {
    await prisma.vehicle.deleteMany({ where: { id: { in: createdVehicleIds } } });
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  if (createdRolePermissionIds.length) {
    await prisma.rolePermission.deleteMany({ where: { id: { in: createdRolePermissionIds } } });
  }
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('vehicle payment lifecycle for auto sales', async () => {
  const departmentsRes = await request('GET', '/api/departments', null, adminToken);
  assert.equal(departmentsRes.status, 200);
  const department = departmentsRes.data.data.items.find((item) => item.type === 'AUTO_SALES');
  assert.ok(department);

  const vehicleCreateRes = await request('POST', '/api/vehicles', {
    departmentId: department.id,
    brand: 'TestBrand',
    model: 'TestModel',
    year: 2024,
    mileage: 10,
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    price: '10000.00',
    description: 'Vehicle payment test',
  }, adminToken);
  assert.equal(vehicleCreateRes.status, 201);
  const vehicleId = vehicleCreateRes.data.data.vehicle.id;
  createdVehicleIds.push(vehicleId);

  const reservationDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const expirationDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const createReservationRes = await request('POST', '/api/vehicle-reservations', {
    vehicleId,
    customerName: 'Jane Doe',
    customerPhone: '0712345678',
    customerEmail: 'jane@example.com',
    reservationAmount: '10000.00',
    depositAmount: '1000.00',
    reservationDate,
    expirationDate,
  }, adminToken);
  assert.equal(createReservationRes.status, 201);
  const reservation = createReservationRes.data.data.vehicleReservation;
  createdReservationIds.push(reservation.id);
  assert.equal(reservation.paymentStatus, 'PENDING');

  const createPaymentRes = await request('POST', '/api/vehicle-payments', {
    reservationId: reservation.id,
    amount: '2000.00',
    method: 'CASH',
    reference: 'PAYREF-01',
  }, adminToken);
  assert.equal(createPaymentRes.status, 201);
  const payment = createPaymentRes.data.data.payment;
  createdPaymentIds.push(payment.id);
  assert.equal(payment.status, 'PENDING');
  assert.equal(Number(payment.amount), 2000);
  assert.equal(payment.reference, 'PAYREF-01');

  const listPaymentsRes = await request('GET', `/api/vehicle-payments/reservation/${reservation.id}`, null, adminToken);
  assert.equal(listPaymentsRes.status, 200);
  assert.equal(listPaymentsRes.data.data.total, 1);
  assert.equal(listPaymentsRes.data.data.payments[0].id, payment.id);

  const getPaymentRes = await request('GET', `/api/vehicle-payments/${payment.id}`, null, adminToken);
  assert.equal(getPaymentRes.status, 200);
  assert.equal(getPaymentRes.data.data.payment.id, payment.id);

  const updatePaymentRes = await request('PUT', `/api/vehicle-payments/${payment.id}`, {
    reference: 'PAYREF-UPDATED',
  }, adminToken);
  assert.equal(updatePaymentRes.status, 200);
  assert.equal(updatePaymentRes.data.data.payment.reference, 'PAYREF-UPDATED');

  const validatePaymentRes = await request('POST', `/api/vehicle-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validatePaymentRes.status, 200);
  assert.equal(validatePaymentRes.data.data.payment.status, 'VERIFIED');

  const secondPaymentRes = await request('POST', '/api/vehicle-payments', {
    reservationId: reservation.id,
    amount: '8000.00',
    method: 'CASH',
    reference: 'PAYREF-02',
  }, adminToken);
  assert.equal(secondPaymentRes.status, 201);
  const secondPayment = secondPaymentRes.data.data.payment;
  createdPaymentIds.push(secondPayment.id);

  const validateSecondRes = await request('POST', `/api/vehicle-payments/${secondPayment.id}/validate`, null, adminToken);
  assert.equal(validateSecondRes.status, 200);
  assert.equal(validateSecondRes.data.data.payment.status, 'VERIFIED');

  const reservationAfterPayments = await request('GET', `/api/vehicle-reservations/${reservation.id}`, null, adminToken);
  assert.equal(reservationAfterPayments.status, 200);
  assert.equal(reservationAfterPayments.data.data.vehicleReservation.paymentStatus, 'COMPLETED');

  const overpayRes = await request('POST', '/api/vehicle-payments', {
    reservationId: reservation.id,
    amount: '1000.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(overpayRes.status, 400);

  const rejectPaymentRes = await request('POST', `/api/vehicle-payments/${secondPayment.id}/reject`, { reason: 'Invalid transaction' }, adminToken);
  assert.equal(rejectPaymentRes.status, 409);
});

test('payment authorization, invalid reservation and duplicate validation handling', async () => {
  const departmentsRes = await request('GET', '/api/departments', null, adminToken);
  assert.equal(departmentsRes.status, 200);
  const autoSalesDepartment = departmentsRes.data.data.items.find((item) => item.type === 'AUTO_SALES');
  const constructionDepartment = departmentsRes.data.data.items.find((item) => item.type === 'CONSTRUCTION');
  assert.ok(autoSalesDepartment);
  assert.ok(constructionDepartment);

  const autoSalesNoPermissionEmail = `autosales-noperm-${Date.now()}@example.com`;
  const autoSalesNoPermissionPassword = 'NoPerm123!';
  await createTestUser({
    email: autoSalesNoPermissionEmail,
    password: autoSalesNoPermissionPassword,
    firstName: 'NoPerm',
    lastName: 'AutoSales',
    roleName: 'SERVICE_ADMIN',
    departmentType: 'AUTO_SALES',
  });
  const autoSalesNoPermToken = await loginTestUser(autoSalesNoPermissionEmail, autoSalesNoPermissionPassword);

  const constructionUserEmail = `construction-${Date.now()}@example.com`;
  const constructionUserPassword = 'ConDept123!';
  await createTestUser({
    email: constructionUserEmail,
    password: constructionUserPassword,
    firstName: 'Other',
    lastName: 'Department',
    roleName: 'AGENT',
    departmentType: 'CONSTRUCTION',
    permissions: ['MANAGE_VEHICLE_RESERVATION'],
  });
  const constructionToken = await loginTestUser(constructionUserEmail, constructionUserPassword);

  const invalidReservationRes = await request('POST', '/api/vehicle-payments', {
    reservationId: 'nonexistent-id',
    amount: '100.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(invalidReservationRes.status, 404);

  const invalidAmountRes = await request('POST', '/api/vehicle-payments', {
    reservationId: 'nonexistent-id',
    amount: '-10.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(invalidAmountRes.status, 400);

  const vehicleCreateRes = await request('POST', '/api/vehicles', {
    departmentId: autoSalesDepartment.id,
    brand: 'TestBrand2',
    model: 'TestModel2',
    year: 2025,
    mileage: 100,
    fuelType: 'Diesel',
    transmission: 'Manual',
    price: '12000.00',
    description: 'Vehicle payment auth test',
  }, adminToken);
  assert.equal(vehicleCreateRes.status, 201);
  const vehicleId = vehicleCreateRes.data.data.vehicle.id;
  createdVehicleIds.push(vehicleId);

  const reservationDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const expirationDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const createReservationRes = await request('POST', '/api/vehicle-reservations', {
    vehicleId,
    customerName: 'Access Control',
    customerPhone: '0722222222',
    customerEmail: 'access@example.com',
    reservationAmount: '12000.00',
    depositAmount: '1200.00',
    reservationDate,
    expirationDate,
  }, adminToken);
  assert.equal(createReservationRes.status, 201);
  const reservation = createReservationRes.data.data.vehicleReservation;
  createdReservationIds.push(reservation.id);

  const noPermRes = await request('POST', '/api/vehicle-payments', {
    reservationId: reservation.id,
    amount: '1000.00',
    method: 'CASH',
  }, autoSalesNoPermToken);
  assert.equal(noPermRes.status, 403);

  const wrongDeptRes = await request('POST', '/api/vehicle-payments', {
    reservationId: reservation.id,
    amount: '1000.00',
    method: 'CASH',
  }, constructionToken);
  assert.equal(wrongDeptRes.status, 403);

  const createPaymentRes = await request('POST', '/api/vehicle-payments', {
    reservationId: reservation.id,
    amount: '1000.00',
    method: 'CASH',
    reference: 'REJECT-TEST',
  }, adminToken);
  assert.equal(createPaymentRes.status, 201);
  const payment = createPaymentRes.data.data.payment;
  createdPaymentIds.push(payment.id);

  const validateRes = await request('POST', `/api/vehicle-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);

  const doubleValidateRes = await request('POST', `/api/vehicle-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(doubleValidateRes.status, 409);

  const cancelPaymentRes = await request('POST', `/api/vehicle-payments/${payment.id}/cancel`, { reason: 'Cancel test' }, adminToken);
  assert.equal(cancelPaymentRes.status, 409);

  const newPaymentRes = await request('POST', '/api/vehicle-payments', {
    reservationId: reservation.id,
    amount: '1000.00',
    method: 'CASH',
    reference: 'REJECT-TEST-2',
  }, adminToken);
  assert.equal(newPaymentRes.status, 201);
  const newPayment = newPaymentRes.data.data.payment;
  createdPaymentIds.push(newPayment.id);

  const rejectPaymentRes = await request('POST', `/api/vehicle-payments/${newPayment.id}/reject`, { reason: 'Reject test' }, adminToken);
  assert.equal(rejectPaymentRes.status, 200);
  assert.equal(rejectPaymentRes.data.data.payment.status, 'REJECTED');

  const auditLogsRes = await request('GET', '/api/audit-logs', null, adminToken);
  assert.equal(auditLogsRes.status, 200);
  assert.ok(Array.isArray(auditLogsRes.data.data.items));
  assert.ok(auditLogsRes.data.data.items.some((log) => log.action && log.action.includes('vehicle_payment')));
});
