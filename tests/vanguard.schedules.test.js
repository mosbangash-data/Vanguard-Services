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

  const loginRes = await request('POST', '/api/auth/login', { identifier: 'admin@vanguard.local', password: 'Admin123!' });
  assert.equal(loginRes.status, 200);
  adminToken = loginRes.data.data.token;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('vanguard schedules CRUD', async () => {
  const deps = await request('GET', '/api/departments', null, adminToken);
  assert.equal(deps.status, 200);
  const department = deps.data.data.items.find((item) => item.type === 'VANGUARD_COACH') || deps.data.data.items[0];

  // create a route
  const routeRes = await request('POST', '/api/destinations', { departmentId: department.id, code: `R_${Date.now()}`, departureCity: 'Goma', arrivalCity: 'Bukavu' }, adminToken);
  assert.equal(routeRes.status, 201);
  const routeId = routeRes.data.data.route.id;

  // create a bus
  const busRes = await request('POST', '/api/buses', { departmentId: department.id, plateNumber: `SCH-${Date.now()}`, brand: 'Test', model: 'Model', seats: 20 }, adminToken);
  assert.equal(busRes.status, 201);
  const busId = busRes.data.data.bus.id;

  const create = await request('POST', '/api/schedules', {
    departmentId: department.id,
    routeId,
    busId,
    departureTime: '08:00',
    availableDays: ['MON','WED','FRI'],
    price: '25.00'
  }, adminToken);
  assert.equal(create.status, 201);
  const scheduleId = create.data.data.schedule.id;

  const getOne = await request('GET', `/api/schedules/${scheduleId}`, null, adminToken);
  assert.equal(getOne.status, 200);

  const list = await request('GET', '/api/schedules', null, adminToken);
  assert.equal(list.status, 200);

  const update = await request('PUT', `/api/schedules/${scheduleId}`, { departureTime: '09:00' }, adminToken);
  assert.equal(update.status, 200);

  const del = await request('DELETE', `/api/schedules/${scheduleId}`, null, adminToken);
  assert.equal(del.status, 200);
});
