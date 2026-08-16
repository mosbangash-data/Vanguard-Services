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

test('reservations create, duplicate and list', async () => {
  const deps = await request('GET', '/api/departments', null, adminToken);
  assert.equal(deps.status, 200);
  const department = deps.data.data.items.find((item) => item.type === 'VANGUARD_COACH') || deps.data.data.items[0];

  const routeRes = await request('POST', '/api/destinations', { departmentId: department.id, code: `RR_${Date.now()}`, departureCity: 'A', arrivalCity: 'B' }, adminToken);
  assert.equal(routeRes.status, 201);
  const routeId = routeRes.data.data.route.id;

  const busRes = await request('POST', '/api/buses', { departmentId: department.id, plateNumber: `RV-${Date.now()}`, brand: 'Brand', model: 'M', seats: 4 }, adminToken);
  assert.equal(busRes.status, 201);
  const busId = busRes.data.data.bus.id;

  const scheduleRes = await request('POST', '/api/schedules', { departmentId: department.id, routeId, busId, departureTime: '08:00', availableDays: ['MON'], price: '8.00' }, adminToken);
  assert.equal(scheduleRes.status, 201);
  const scheduleId = scheduleRes.data.data.schedule.id;

  const now = new Date();
  const departureAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  const arrivalAt = new Date(now.getTime() + 26 * 3600 * 1000).toISOString();

  const tripRes = await request('POST', '/api/trips', { scheduleId, departureAt, arrivalAt }, adminToken);
  assert.equal(tripRes.status, 201);
  const tripId = tripRes.data.data.trip.id;

  const create = await request('POST', '/api/reservations', { tripId, customerName: 'Alice', customerPhone: '999888777', seatNumber: '1' }, adminToken);
  assert.equal(create.status, 201);

  // duplicate seat should fail
  const dup = await request('POST', '/api/reservations', { tripId, customerName: 'Bob', customerPhone: '555444333', seatNumber: '1' }, adminToken);
  assert.equal(dup.status, 409);

  const list = await request('GET', `/api/reservations?tripId=${tripId}`, null, adminToken);
  assert.equal(list.status, 200);
  const items = list.data.data.items;
  assert.equal(items.length, 1);

  const del = await request('DELETE', `/api/reservations/${items[0].id}`, null, adminToken);
  assert.equal(del.status, 200);
});
