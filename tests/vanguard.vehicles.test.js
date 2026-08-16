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
  if (body !== undefined && body !== null) options.body = typeof body === 'string' ? body : JSON.stringify(body);

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
    password: 'Admin123!',
  });

  assert.equal(loginRes.status, 200, 'Admin login should succeed');
  adminToken = loginRes.data.data.token;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('vanguard vehicles CRUD', async () => {
  const deps = await request('GET', '/api/departments', null, adminToken);
  assert.equal(deps.status, 200);
  const department = deps.data.data.items.find((item) => item.type === 'AUTO_SALES') || deps.data.data.items[0];
  assert.ok(department, 'Department must exist');

  const create = await request('POST', '/api/vehicles', {
    departmentId: department.id,
    brand: 'Toyota',
    model: 'Corolla',
    year: 2020,
    mileage: 12000,
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    price: '22000.00',
    description: 'Test vehicle',
  }, adminToken);

  assert.equal(create.status, 201);
  const vehicleId = create.data.data.vehicle.id;
  assert.ok(vehicleId, 'Created vehicle should have an id');

  const getOne = await request('GET', `/api/vehicles/${vehicleId}`, null, adminToken);
  assert.equal(getOne.status, 200);
  assert.equal(getOne.data.data.vehicle.id, vehicleId);

  const list = await request('GET', '/api/vehicles', null, adminToken);
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.data.data.items));

  const update = await request('PUT', `/api/vehicles/${vehicleId}`, {
    brand: 'Honda',
  }, adminToken);
  assert.equal(update.status, 200);
  assert.equal(update.data.data.vehicle.brand, 'Honda');

  const del = await request('DELETE', `/api/vehicles/${vehicleId}`, null, adminToken);
  assert.equal(del.status, 200);
});

test('public vehicle route remains accessible with optional invalid token and protected route rejects invalid token', async () => {
  const deps = await request('GET', '/api/departments', null, adminToken);
  assert.equal(deps.status, 200);
  const department = deps.data.data.items.find((item) => item.type === 'AUTO_SALES') || deps.data.data.items[0];
  assert.ok(department, 'Department must exist');

  const createRes = await request('POST', '/api/vehicles', {
    departmentId: department.id,
    brand: 'PublicTestBrand',
    model: 'PublicTestModel',
    year: 2022,
    mileage: 500,
    fuelType: 'Electric',
    transmission: 'Automatic',
    price: '18000.00',
    description: 'Public auth test vehicle',
  }, adminToken);
  assert.equal(createRes.status, 201);

  const listWithoutToken = await request('GET', '/api/vehicles');
  assert.equal(listWithoutToken.status, 200);
  assert.ok(Array.isArray(listWithoutToken.data.data.items));

  const listWithValidToken = await request('GET', '/api/vehicles', null, adminToken);
  assert.equal(listWithValidToken.status, 200);
  assert.ok(Array.isArray(listWithValidToken.data.data.items));

  const listWithInvalidToken = await request('GET', '/api/vehicles', null, 'invalid.token');
  assert.equal(listWithInvalidToken.status, 200, 'Public route should not fail on invalid optional token');
  assert.ok(Array.isArray(listWithInvalidToken.data.data.items));

  const protectedWithInvalidToken = await request('POST', '/api/vehicles', {
    departmentId: department.id,
    brand: 'ShouldFail',
    model: 'ShouldFail',
    year: 2022,
    mileage: 100,
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    price: '1000.00',
    description: 'Should fail protected',
  }, 'invalid.token');
  assert.equal(protectedWithInvalidToken.status, 401, 'Protected route should reject invalid token');
});
