const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/app');
const { main: seedMain } = require('../prisma/seed');

let server;
let baseUrl;
let adminToken;

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
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}

test.before(async () => {
  await seedMain();

  server = http.createServer(app);
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve())));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  const loginRes = await request('POST', '/api/auth/login', {
    identifier: 'admin@vanguard.local',
    password: 'Admin123!'
  });

  assert.equal(loginRes.status, 200, 'Admin login should succeed');
  adminToken = loginRes.data.data.token;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('vehicle reservation create, duplicate, list and cancel', async () => {
  const departmentsRes = await request('GET', '/api/departments', null, adminToken);
  assert.equal(departmentsRes.status, 200);
  const department = departmentsRes.data.data.items.find((item) => item.type === 'AUTO_SALES') || departmentsRes.data.data.items[0];
  assert.ok(department, 'No department available for reservation test');

  const vehicleCreateRes = await request('POST', '/api/vehicles', {
    departmentId: department.id,
    brand: 'TestBrand',
    model: 'TestModel',
    year: 2021,
    mileage: 1000,
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    price: '15000.00',
    description: 'Reservation test vehicle'
  }, adminToken);
  assert.equal(vehicleCreateRes.status, 201);
  const vehicleId = vehicleCreateRes.data.data.vehicle.id;
  assert.ok(vehicleId, 'Vehicle id is required');

  const reservationDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const expirationDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const createRes = await request('POST', '/api/vehicle-reservations', {
    vehicleId,
    customerName: 'John Doe',
    customerPhone: '1234567890',
    customerEmail: 'john@example.com',
    reservationAmount: '500.00',
    depositAmount: '100.00',
    reservationDate,
    expirationDate
  }, adminToken);

  assert.equal(createRes.status, 201);
  const reservation = createRes.data.data.vehicleReservation;
  assert.equal(reservation.vehicleId, vehicleId);
  assert.equal(reservation.status, 'PENDING');
  assert.equal(reservation.paymentStatus, 'PENDING');
  assert.ok(reservation.reservationCode, 'Reservation code should be generated');

  const vehicleAfterRes = await request('GET', `/api/vehicles/${vehicleId}`, null, adminToken);
  assert.equal(vehicleAfterRes.status, 200);
  assert.equal(vehicleAfterRes.data.data.vehicle.status, 'RESERVED');

  const duplicateRes = await request('POST', '/api/vehicle-reservations', {
    vehicleId,
    customerName: 'Jane Doe',
    customerPhone: '0987654321',
    reservationAmount: '500.00',
    reservationDate,
    expirationDate
  }, adminToken);
  assert.equal(duplicateRes.status, 409, 'Duplicate reservation should be blocked');

  const vehicleAfterDuplicate = await request('GET', `/api/vehicles/${vehicleId}`, null, adminToken);
  assert.equal(vehicleAfterDuplicate.status, 200);
  assert.equal(vehicleAfterDuplicate.data.data.vehicle.status, 'RESERVED');

  const listRes = await request('GET', `/api/vehicle-reservations?vehicleId=${vehicleId}`, null, adminToken);
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.data.data.items));
  assert.equal(listRes.data.data.items.length, 1);
  assert.equal(listRes.data.data.items[0].id, reservation.id);

  const cancelRes = await request('POST', `/api/vehicle-reservations/${reservation.id}/cancel`, {
    reason: 'Customer changed mind',
    penaltyAmount: '50.00',
    refundAmount: '450.00'
  }, adminToken);
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.data.data.vehicleReservation.status, 'CANCELLED');

  const vehicleAfterCancel = await request('GET', `/api/vehicles/${vehicleId}`, null, adminToken);
  assert.equal(vehicleAfterCancel.status, 200);
  assert.equal(vehicleAfterCancel.data.data.vehicle.status, 'AVAILABLE');
});

test('vehicle reservation expired entry allows new reservation and keeps vehicle state consistent', async () => {
  const departmentsRes = await request('GET', '/api/departments', null, adminToken);
  assert.equal(departmentsRes.status, 200);
  const department = departmentsRes.data.data.items.find((item) => item.type === 'AUTO_SALES') || departmentsRes.data.data.items[0];
  assert.ok(department, 'No department available for reservation test');

  const vehicleCreateRes = await request('POST', '/api/vehicles', {
    departmentId: department.id,
    brand: 'ExpireBrand',
    model: 'ExpireModel',
    year: 2021,
    mileage: 1200,
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    price: '10000.00',
    description: 'Expired reservation test vehicle'
  }, adminToken);
  assert.equal(vehicleCreateRes.status, 201);
  const vehicleId = vehicleCreateRes.data.data.vehicle.id;

  const reservationDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const expirationDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

  const expiredRes = await request('POST', '/api/vehicle-reservations', {
    vehicleId,
    customerName: 'Old Customer',
    customerPhone: '1231231234',
    reservationAmount: '300.00',
    reservationDate,
    expirationDate
  }, adminToken);
  assert.equal(expiredRes.status, 201);
  assert.equal(expiredRes.data.data.vehicleReservation.status, 'PENDING');

  const newReservationDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const newExpirationDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const newRes = await request('POST', '/api/vehicle-reservations', {
    vehicleId,
    customerName: 'New Customer',
    customerPhone: '3213214321',
    reservationAmount: '350.00',
    reservationDate: newReservationDate,
    expirationDate: newExpirationDate
  }, adminToken);
  assert.equal(newRes.status, 201, 'New reservation should be allowed after expired entry');
  assert.equal(newRes.data.data.vehicleReservation.status, 'PENDING');

  const allRes = await request('GET', `/api/vehicle-reservations?vehicleId=${vehicleId}`, null, adminToken);
  assert.equal(allRes.status, 200);
  const expiredEntry = allRes.data.data.items.find((item) => item.id === expiredRes.data.data.vehicleReservation.id);
  assert.equal(expiredEntry.status, 'EXPIRED');
  const newEntry = allRes.data.data.items.find((item) => item.id === newRes.data.data.vehicleReservation.id);
  assert.equal(newEntry.status, 'PENDING');

  const vehicleAfterNewRes = await request('GET', `/api/vehicles/${vehicleId}`, null, adminToken);
  assert.equal(vehicleAfterNewRes.status, 200);
  assert.equal(vehicleAfterNewRes.data.data.vehicle.status, 'RESERVED');
});

test('concurrent vehicle reservation attempts should allow only one active reservation', async () => {
  const departmentsRes = await request('GET', '/api/departments', null, adminToken);
  assert.equal(departmentsRes.status, 200);
  const department = departmentsRes.data.data.items.find((item) => item.type === 'AUTO_SALES') || departmentsRes.data.data.items[0];
  assert.ok(department, 'No department available for reservation test');

  const vehicleCreateRes = await request('POST', '/api/vehicles', {
    departmentId: department.id,
    brand: 'ConcurrentBrand',
    model: 'ConcurrentModel',
    year: 2021,
    mileage: 1500,
    fuelType: 'Gasoline',
    transmission: 'Manual',
    price: '12000.00',
    description: 'Concurrent reservation test vehicle'
  }, adminToken);
  assert.equal(vehicleCreateRes.status, 201);
  const vehicleId = vehicleCreateRes.data.data.vehicle.id;

  const reservationDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const expirationDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const bookings = await Promise.all([
    request('POST', '/api/vehicle-reservations', {
      vehicleId,
      customerName: 'Alice',
      customerPhone: '5550000001',
      reservationAmount: '400.00',
      reservationDate,
      expirationDate
    }, adminToken),
    request('POST', '/api/vehicle-reservations', {
      vehicleId,
      customerName: 'Bob',
      customerPhone: '5550000002',
      reservationAmount: '400.00',
      reservationDate,
      expirationDate
    }, adminToken),
  ]);

  const success = bookings.filter((res) => res.status === 201);
  const conflict = bookings.filter((res) => res.status === 409);

  assert.equal(success.length, 1, 'One reservation should succeed');
  assert.equal(conflict.length, 1, 'One concurrent reservation should be blocked');

  const activeList = await request('GET', `/api/vehicle-reservations?vehicleId=${vehicleId}`, null, adminToken);
  assert.equal(activeList.status, 200);
  assert.ok(activeList.data.data.items.length >= 1);
  assert.equal(activeList.data.data.items.filter((item) => ['PENDING', 'CONFIRMED'].includes(item.status)).length, 1);
});
