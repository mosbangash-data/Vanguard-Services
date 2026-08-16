const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../../src/app');
const { main: seedMain } = require('../../prisma/seed');
const prisma = require('../../src/config/prisma');

let server;
let baseUrl;
let adminToken;
const created = {};

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

  const login = await request('POST', '/api/auth/login', { identifier: 'admin@vanguard.local', password: 'Admin123!' });
  assert.equal(login.status, 200);
  adminToken = login.data.data.token;
});

test.after(async () => {
  // cleanup created entities
  try {
    if (created.ticketId) await prisma.ticket.deleteMany({ where: { id: created.ticketId } });
    if (created.reservationId) await prisma.reservation.deleteMany({ where: { id: created.reservationId } });
    if (created.tripId) await prisma.trip.deleteMany({ where: { id: created.tripId } });
    if (created.scheduleId) await prisma.schedule.deleteMany({ where: { id: created.scheduleId } });
    if (created.busId) await prisma.bus.deleteMany({ where: { id: created.busId } });
    if (created.routeId) await prisma.route.deleteMany({ where: { id: created.routeId } });
    if (created.parcelId) await prisma.parcel.deleteMany({ where: { id: created.parcelId } });
    if (created.notificationId) await prisma.notification.deleteMany({ where: { id: created.notificationId } });
  } catch (e) {
    // ignore cleanup errors
  }
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('Full E2E flow: destination -> bus -> schedule -> trip -> reservation -> ticket -> parcel -> notification -> audit', async () => {
  // get department id
  const dept = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  assert.ok(dept && dept.id);

  // create destination
  const destRes = await request('POST', '/api/destinations', { departmentId: dept.id, code: `RTE${Date.now()}`, departureCity: 'CityA', arrivalCity: 'CityB' }, adminToken);
  assert.equal(destRes.status, 201);
  const route = destRes.data.data.route;
  assert.ok(route && route.id);
  created.routeId = route.id;

  // create bus
  const busRes = await request('POST', '/api/buses', { departmentId: dept.id, plateNumber: `PLT${Date.now()}`, brand: 'Volvo', model: 'X', seats: 40 }, adminToken);
  assert.equal(busRes.status, 201);
  const bus = busRes.data.data.bus;
  assert.ok(bus && bus.id);
  created.busId = bus.id;

  // create schedule
  const scheduleRes = await request('POST', '/api/schedules', { departmentId: dept.id, routeId: route.id, busId: bus.id, departureTime: '08:00', availableDays: ['MON'], price: '25.00' }, adminToken);
  assert.equal(scheduleRes.status, 201);
  const schedule = scheduleRes.data.data.schedule;
  assert.ok(schedule && schedule.id);
  created.scheduleId = schedule.id;

  // create trip
  const now = new Date();
  const dep = new Date(now.getTime() + 24 * 3600 * 1000);
  const arr = new Date(dep.getTime() + 2 * 3600 * 1000);
  const tripRes = await request('POST', '/api/trips', { scheduleId: schedule.id, departureAt: dep.toISOString(), arrivalAt: arr.toISOString() }, adminToken);
  assert.equal(tripRes.status, 201);
  const trip = tripRes.data.data.trip;
  assert.ok(trip && trip.id);
  created.tripId = trip.id;

  // create reservation
  const reservationRes = await request('POST', '/api/reservations', { tripId: trip.id, customerName: 'John Doe', customerPhone: '+33123456789', seatNumber: '1' }, adminToken);
  assert.equal(reservationRes.status, 201);
  const reservation = reservationRes.data.data.reservation;
  assert.ok(reservation && reservation.id);
  created.reservationId = reservation.id;

  // payment validation triggers automatic ticket creation
  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '25.00',
    method: 'CASH',
    reference: `INT-${Date.now()}`,
  }, adminToken);
  assert.equal(paymentRes.status, 201);
  const payment = paymentRes.data.data.payment;

  const validatePaymentRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validatePaymentRes.status, 200);
  const ticket = validatePaymentRes.data.data.ticket;
  assert.ok(ticket && ticket.id);
  created.ticketId = ticket.id;

  const replayTicketRes = await request('POST', '/api/tickets', { reservationId: reservation.id }, adminToken);
  assert.equal(replayTicketRes.status, 200);
  assert.equal(replayTicketRes.data.data.created, false);
  assert.equal(replayTicketRes.data.data.ticket.id, ticket.id);

  // create parcel
  const parcelRes = await request('POST', '/api/parcels', { senderName: 'Alice', senderPhone: '+33000000001', recipientName: 'Bob', recipientPhone: '+33000000002', originCity: 'CityA', destinationCity: 'CityB', weightKg: '1.5', volumeM3: '0.01', amount: '10.00' }, adminToken);
  assert.equal(parcelRes.status, 201);
  const parcel = parcelRes.data.data.parcel;
  assert.ok(parcel && parcel.id);
  created.parcelId = parcel.id;

  // create notification
  const notifRes = await request('POST', '/api/notifications', { title: 'Integration', message: 'Flow complete' }, adminToken);
  assert.equal(notifRes.status, 201);
  const notif = notifRes.data.data.notification;
  assert.ok(notif && notif.id);
  created.notificationId = notif.id;

  // verify audit logs contain entries for key actions
  const auditRes = await request('GET', '/api/audit-logs', null, adminToken);
  assert.equal(auditRes.status, 200);
  assert.equal(auditRes.data.success, true);
  const total = auditRes.data.data.total;
  assert.ok(total >= 1);
});
