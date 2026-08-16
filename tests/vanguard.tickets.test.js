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

const createCoachTicketFixture = async () => {
  const deps = await request('GET', '/api/departments', null, adminToken);
  assert.equal(deps.status, 200);
  const department = deps.data.data.items.find((item) => item.type === 'VANGUARD_COACH');
  assert.ok(department, 'Vanguard Coach department must exist for ticket tests');

  const routeRes = await request('POST', '/api/destinations', { departmentId: department.id, code: `TK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, departureCity: 'Kinshasa', arrivalCity: 'Lubumbashi' }, adminToken);
  assert.equal(routeRes.status, 201);
  const routeId = routeRes.data.data.route.id;

  const busRes = await request('POST', '/api/buses', { departmentId: department.id, plateNumber: `TKB-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, brand: 'Brand', model: 'M', seats: 3 }, adminToken);
  assert.equal(busRes.status, 201);
  const busId = busRes.data.data.bus.id;

  const scheduleRes = await request('POST', '/api/schedules', { departmentId: department.id, routeId, busId, departureTime: '08:00', availableDays: ['MON'], price: '12.00' }, adminToken);
  assert.equal(scheduleRes.status, 201);
  const scheduleId = scheduleRes.data.data.schedule.id;

  const now = new Date();
  const departureAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  const arrivalAt = new Date(now.getTime() + 26 * 3600 * 1000).toISOString();

  const tripRes = await request('POST', '/api/trips', { scheduleId, departureAt, arrivalAt }, adminToken);
  assert.equal(tripRes.status, 201);
  const tripId = tripRes.data.data.trip.id;

  const reservationRes = await request('POST', '/api/reservations', { tripId, customerName: 'TicketUser', customerPhone: '777666555', seatNumber: '1' }, adminToken);
  assert.equal(reservationRes.status, 201);
  const reservationId = reservationRes.data.data.reservation.id;

  const paymentRes = await request('POST', '/api/reservation-payments', { reservationId, amount: '12.00', method: 'CASH', reference: `TK-${Date.now()}` }, adminToken);
  assert.equal(paymentRes.status, 201);
  const payment = paymentRes.data.data.payment;

  const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);
  const ticket = validateRes.data.data.ticket;
  assert.ok(ticket.qrCode && ticket.ticketCode && ticket.serialNumber);

  return { ticket, reservationId };
};

test('ticket generation for reservation', async () => {
  const { ticket } = await createCoachTicketFixture();

  const ticketRes = await request('POST', '/api/tickets', { reservationId: ticket.reservationId }, adminToken);
  assert.equal(ticketRes.status, 200);
  assert.equal(ticketRes.data.data.created, false);
  assert.equal(ticketRes.data.data.ticket.id, ticket.id);
  assert.ok(ticketRes.data.data.ticket.qrCode && ticketRes.data.data.ticket.ticketCode && ticketRes.data.data.ticket.serialNumber);
});

test('ticket scan accepts a valid ticket and marks it used', async () => {
  const { ticket } = await createCoachTicketFixture();

  const scanRes = await request('POST', '/api/tickets/scan', { qrCode: ticket.qrCode }, adminToken);
  assert.equal(scanRes.status, 200);
  assert.equal(scanRes.data.valid, true);
  assert.equal(scanRes.data.status, 'VALID');
  assert.equal(scanRes.data.ticketCode, ticket.ticketCode);
  assert.equal(scanRes.data.message, 'Billet valide.');

  const fetchTicket = await request('GET', `/api/tickets/${ticket.ticketCode}`, null, adminToken);
  assert.equal(fetchTicket.status, 200);
  assert.equal(fetchTicket.data.data.ticket.status, 'USED');
  assert.ok(fetchTicket.data.data.ticket.usedAt);
});

test('ticket scan rejects an already used ticket', async () => {
  const { ticket } = await createCoachTicketFixture();

  const firstScan = await request('POST', '/api/tickets/scan', { qrCode: ticket.qrCode }, adminToken);
  assert.equal(firstScan.status, 200);

  const secondScan = await request('POST', '/api/tickets/scan', { qrCode: ticket.qrCode }, adminToken);
  assert.equal(secondScan.status, 200);
  assert.equal(secondScan.data.valid, false);
  assert.equal(secondScan.data.status, 'USED');
  assert.equal(secondScan.data.message, 'Billet déjà utilisé.');
});

test('ticket scan rejects cancelled tickets and invalid QR values', async () => {
  const { ticket } = await createCoachTicketFixture();

  const cancelRes = await request('PATCH', `/api/tickets/${ticket.ticketCode}/cancel`, null, adminToken);
  assert.equal(cancelRes.status, 200);

  const scanCancelled = await request('POST', '/api/tickets/scan', { qrCode: ticket.qrCode }, adminToken);
  assert.equal(scanCancelled.status, 200);
  assert.equal(scanCancelled.data.valid, false);
  assert.equal(scanCancelled.data.status, 'CANCELLED');

  const invalidScan = await request('POST', '/api/tickets/scan', { qrCode: 'vanguard://ticket/INVALID-QR' }, adminToken);
  assert.equal(invalidScan.status, 200);
  assert.equal(invalidScan.data.valid, false);
  assert.equal(invalidScan.data.status, 'NOT_FOUND');
});

test('ticket scan is blocked for unauthorized users and wrong department', async () => {
  const { ticket } = await createCoachTicketFixture();

  const loginRes = await request('POST', '/api/auth/login', { identifier: 'construction@vanguard.local', password: 'Construction123!' });
  assert.equal(loginRes.status, 200);
  const constructionToken = loginRes.data.data.token;

  const wrongDeptScan = await request('POST', '/api/tickets/scan', { qrCode: ticket.qrCode }, constructionToken);
  assert.equal(wrongDeptScan.status, 403);

  const noTokenScan = await request('POST', '/api/tickets/scan', { qrCode: ticket.qrCode });
  assert.equal(noTokenScan.status, 401);
});

test('two simultaneous scans do not validate the same ticket twice', async () => {
  const { ticket } = await createCoachTicketFixture();

  const results = await Promise.all([
    request('POST', '/api/tickets/scan', { qrCode: ticket.qrCode }, adminToken),
    request('POST', '/api/tickets/scan', { qrCode: ticket.qrCode }, adminToken),
  ]);

  const validCount = results.filter((result) => result.status === 200 && result.data.valid === true).length;
  const usedCount = results.filter((result) => result.status === 200 && result.data.status === 'USED').length;
  assert.equal(validCount, 1);
  assert.equal(usedCount, 1);
});
