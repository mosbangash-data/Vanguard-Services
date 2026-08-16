const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
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
  await prisma.reservation.deleteMany();
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('seats listing and availability', async () => {
  const deps = await request('GET', '/api/departments', null, adminToken);
  assert.equal(deps.status, 200);
  const department = deps.data.data.items.find((item) => item.type === 'VANGUARD_COACH') || deps.data.data.items[0];

  const routeRes = await request('POST', '/api/destinations', { departmentId: department.id, code: `RS_${Date.now()}`, departureCity: 'A', arrivalCity: 'B' }, adminToken);
  assert.equal(routeRes.status, 201);
  const routeId = routeRes.data.data.route.id;

  const busRes = await request('POST', '/api/buses', { departmentId: department.id, plateNumber: `SE-${Date.now()}`, brand: 'Brand', model: 'M', seats: 5 }, adminToken);
  assert.equal(busRes.status, 201);
  const busId = busRes.data.data.bus.id;

  const scheduleRes = await request('POST', '/api/schedules', { departmentId: department.id, routeId, busId, departureTime: '08:00', availableDays: ['MON'], price: '5.00' }, adminToken);
  assert.equal(scheduleRes.status, 201);
  const scheduleId = scheduleRes.data.data.schedule.id;

  const now = new Date();
  const departureAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  const arrivalAt = new Date(now.getTime() + 26 * 3600 * 1000).toISOString();

  const tripRes = await request('POST', '/api/trips', { scheduleId, departureAt, arrivalAt }, adminToken);
  assert.equal(tripRes.status, 201);
  const tripId = tripRes.data.data.trip.id;

  // create a reservation directly to mark a seat occupied
  const reservation = await prisma.reservation.create({ data: { reservationCode: `R-${Date.now()}`, tripId, customerName: 'John', customerPhone: '111222333', seatNumber: '1', totalAmount: '5.00' } });

  const seats = await request('GET', `/api/seats?busId=${busId}&tripId=${tripId}`, null, adminToken);
  assert.equal(seats.status, 200);
  const items = seats.data.data.items;
  assert.equal(items.length, 5);
  const seat1 = items.find(s => s.seatNumber === '1');
  assert.equal(seat1.status, 'OCCUPIED');

  const seatOneDirect = await request('GET', `/api/seats/${busId}/1?tripId=${tripId}`, null, adminToken);
  assert.equal(seatOneDirect.status, 200);
  assert.equal(seatOneDirect.data.data.seat.status, 'OCCUPIED');
});
