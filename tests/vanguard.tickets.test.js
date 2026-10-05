const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const crypto = require('crypto');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const env = require('../src/config/env');
const { main: seedMain } = require('../prisma/seed');

let server;
let baseUrl;
let adminToken;
let agentToken;

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
  const agentLogin = await request('POST', '/api/auth/login', { identifier: 'coach.agent@vanguard.local', password: process.env.COACH_AGENT_PASSWORD || 'dev-coach-agent-password' });
  assert.equal(agentLogin.status, 200);
  agentToken = agentLogin.data.data.token;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

const createCoachTicketFixture = async ({ validate = true } = {}) => {
  const deps = await request('GET', '/api/departments', null, adminToken);
  assert.equal(deps.status, 200);
  const department = deps.data.data.items.find((item) => item.type === 'VANGUARD_COACH');
  assert.ok(department, 'Vanguard Coach department must exist for ticket tests');
  const agency = await prisma.agency.findFirst({ where: { departmentId: department.id }, select: { id: true } });
  assert.ok(agency, 'Vanguard Coach agency must exist for reservation tests');

  const routeRes = await request('POST', '/api/destinations', { departmentId: department.id, code: `TK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, departureCity: 'Kinshasa', arrivalCity: 'Lubumbashi' }, adminToken);
  assert.equal(routeRes.status, 201);
  const routeId = routeRes.data.data.route.id;

  const busRes = await request('POST', '/api/buses', { departmentId: department.id, plateNumber: `TKB-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, brand: 'Brand', model: 'M', seats: 3 }, adminToken);
  assert.equal(busRes.status, 201);
  const busId = busRes.data.data.bus.id;

  const scheduleRes = await request('POST', '/api/schedules', { departmentId: department.id, agencyId: agency.id, routeId, busId, departureTime: '08:00', availableDays: ['MON'], price: '12.00' }, adminToken);
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
  const payment = reservationRes.data.data.payment;
  assert.equal(payment.status, 'PENDING');
  assert.equal(Number(payment.amount), 12);

  let ticket = null;
  if (validate) {
    const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
    assert.equal(validateRes.status, 200);
    ticket = validateRes.data.data.ticket;
    assert.ok(ticket.qrCode && ticket.ticketCode && ticket.serialNumber);
  }

  return { ticket, reservationId, payment, tripId };
};

test('cash validation requires full settlement, rejection preserves reservation, and cancellation preserves history', async () => {
  const { ticket, reservationId, payment, tripId } = await createCoachTicketFixture();
  assert.equal(payment.status, 'PENDING');
  assert.equal(ticket.status, 'VALID');

  const deleteRes = await request('DELETE', `/api/reservations/${reservationId}`, null, agentToken);
  assert.equal(deleteRes.status, 409);
  const immutableRes = await request('PUT', `/api/reservations/${reservationId}`, { tripId: 'other-trip' }, agentToken);
  assert.equal(immutableRes.status, 400);
  const beforeEdit = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { payments: true, tickets: true } });
  const edited = await request('PUT', `/api/reservations/${reservationId}`, { customerName: 'Updated passenger', customerPhone: '777666000' }, agentToken);
  assert.equal(edited.status, 200);
  const afterEdit = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { payments: true, tickets: true } });
  assert.equal(afterEdit.id, beforeEdit.id);
  assert.equal(afterEdit.reservationCode, beforeEdit.reservationCode);
  assert.equal(afterEdit.tripId, beforeEdit.tripId);
  assert.equal(afterEdit.seatNumber, beforeEdit.seatNumber);
  assert.equal(afterEdit.payments[0].id, beforeEdit.payments[0].id);
  assert.equal(afterEdit.tickets[0].id, beforeEdit.tickets[0].id);
  const cancelMissingReason = await request('POST', `/api/reservations/${reservationId}/cancel`, {}, agentToken);
  assert.equal(cancelMissingReason.status, 400);
  const cancelRes = await request('POST', `/api/reservations/${reservationId}/cancel`, { reason: 'Passenger requested cancellation' }, agentToken);
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.data.data.reservation.status, 'CANCELLED');

  const retainedReservation = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { payments: true, tickets: true } });
  assert.equal(retainedReservation.payments.length, 1);
  assert.equal(retainedReservation.payments[0].status, 'VERIFIED');
  assert.equal(retainedReservation.payments[0].reservationId, reservationId);
  assert.equal(retainedReservation.tickets[0].status, 'CANCELLED');
  assert.equal(await prisma.reservationCancellation.count({ where: { reservationId } }), 1);
  const repeatValidation = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(repeatValidation.status, 409);
  assert.equal(await prisma.ticket.count({ where: { reservationId } }), 1);

  const replacement = await request('POST', '/api/reservations', { tripId, customerName: 'Replacement', customerPhone: '777666554', seatNumber: '1' }, adminToken);
  assert.equal(replacement.status, 201);
  assert.equal(replacement.data.data.reservation.status, 'PENDING');
  assert.equal(replacement.data.data.payment.status, 'PENDING');
});

test('a rejected cash payment needs a reason and keeps the reservation pending', async () => {
  const { reservationId, payment } = await createCoachTicketFixture({ validate: false });
  const missingReason = await request('POST', `/api/reservation-payments/${payment.id}/reject`, {}, adminToken);
  assert.equal(missingReason.status, 400);
  const rejected = await request('POST', `/api/reservation-payments/${payment.id}/reject`, { reason: 'Cash amount did not match' }, adminToken);
  assert.equal(rejected.status, 200);
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  assert.equal(reservation.status, 'PENDING');
  assert.equal(rejected.data.data.payment.status, 'REJECTED');
  assert.equal(rejected.data.data.payment.comment, 'Cash amount did not match');
});

test('partial cash validation keeps the reservation pending and creates one ticket only at full payment', async () => {
  const { reservationId, payment } = await createCoachTicketFixture({ validate: false });
  const mobilePayment = await request('POST', '/api/reservation-payments', { reservationId, amount: '1.00', method: 'MOBILE_MONEY', channel: 'ONLINE' }, adminToken);
  assert.equal(mobilePayment.status, 409);
  const reduced = await request('PUT', `/api/reservation-payments/${payment.id}`, { amount: '5.00' }, adminToken);
  assert.equal(reduced.status, 200);
  const first = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, agentToken);
  assert.equal(first.status, 200);
  assert.equal(first.data.data.ticket, null);
  assert.equal((await prisma.reservation.findUnique({ where: { id: reservationId } })).status, 'PENDING');
  assert.equal(await prisma.ticket.count({ where: { reservationId } }), 0);

  const secondPayment = await request('POST', '/api/reservation-payments', { reservationId, amount: '7.00', method: 'CASH' }, adminToken);
  assert.equal(secondPayment.status, 201);
  const completed = await request('POST', `/api/reservation-payments/${secondPayment.data.data.payment.id}/validate`, null, agentToken);
  assert.equal(completed.status, 200);
  assert.equal((await prisma.reservation.findUnique({ where: { id: reservationId } })).status, 'CONFIRMED');
  assert.ok(completed.data.data.ticket);
  assert.equal(await prisma.ticket.count({ where: { reservationId } }), 1);
});

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

test('ticket scanner rejects unsigned, legacy, tampered, truncated and empty QR values', async () => {
  const { ticket } = await createCoachTicketFixture();

  const bareCode = await request('POST', '/api/tickets/scan', { qrCode: ticket.ticketCode }, adminToken);
  assert.equal(bareCode.data.status, 'INVALID');

  const tamperedQr = `${ticket.qrCode}x`;
  const tampered = await request('POST', '/api/tickets/scan', { qrCode: tamperedQr }, adminToken);
  assert.equal(tampered.data.valid, false);
  assert.equal(tampered.data.status, 'INVALID');

  for (const qrCode of [
    `vanguard://ticket/${ticket.ticketCode}`,
    '',
    ticket.qrCode.slice(0, -8),
  ]) {
    const result = await request('POST', '/api/tickets/scan', { qrCode }, adminToken);
    assert.equal(result.data.status, 'INVALID');
  }

  for (const field of ['ticketCode', 'ticketId', 'tripId']) {
    const payload = JSON.parse(ticket.qrCode);
    payload[field] = `${payload[field]}-tampered`;
    const result = await request('POST', '/api/tickets/scan', { qrCode: JSON.stringify(payload) }, adminToken);
    assert.equal(result.data.status, 'INVALID');
  }

  const ticketAfterRejectedScans = await prisma.ticket.findUnique({ where: { id: ticket.id } });
  assert.equal(ticketAfterRejectedScans.status, 'VALID');
});

test('ticket scanner rejects expired and unknown versioned signed QR payloads', async () => {
  const { ticket } = await createCoachTicketFixture();
  const qr = JSON.parse(ticket.qrCode);
  const signPayload = (payload) => {
    const signedFields = ['v', 'ticketCode', 'ticketId', 'tripId', 'issuedAt', 'expiresAt', 'nonce'];
    const body = Object.fromEntries(signedFields.map((field) => [field, payload[field]]));
    const sig = crypto.createHmac('sha256', env.ticketQrSecret).update(JSON.stringify(body)).digest('base64url');
    return JSON.stringify({ ...body, sig });
  };
  const expiredQr = signPayload({ ...qr, expiresAt: new Date(Date.now() - 1000).toISOString() });
  const expired = await request('POST', '/api/tickets/scan', { qrCode: expiredQr }, adminToken);
  assert.equal(expired.data.status, 'INVALID');

  const unknownQr = signPayload({ ...qr, ticketCode: 'VG-FFFFFFFFFFFFFFFF' });
  const unknown = await request('POST', '/api/tickets/scan', { qrCode: unknownQr }, adminToken);
  assert.equal(unknown.data.status, 'INVALID');
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
  assert.equal(invalidScan.data.status, 'INVALID');
});

test('public ticket lookup exposes only boarding details and public print requires login', async () => {
  const { ticket } = await createCoachTicketFixture();
  const publicTicket = await request('GET', `/tickets/${ticket.ticketCode}`);
  assert.equal(publicTicket.status, 200);
  assert.ok(publicTicket.data.data.ticket.reservation.customerName);
  assert.ok(publicTicket.data.data.ticket.reservation.customerPhone);
  assert.equal(publicTicket.data.data.ticket.id, undefined);
  assert.equal(publicTicket.data.data.ticket.reservation.reservationCode, undefined);
  assert.equal(publicTicket.data.data.ticket.reservation.customerEmail, undefined);
  assert.equal(publicTicket.data.data.ticket.reservation.totalAmount, undefined);
  const print = await request('GET', `/tickets/${ticket.ticketCode}/print`);
  assert.equal(print.status, 401);
  const firstPrint = await request('POST', `/tickets/${ticket.ticketCode}/print-event`, { format: '58mm' });
  assert.equal(firstPrint.status, 200);
  assert.equal(firstPrint.data.data.printType, 'first_print');
  const reprint = await request('POST', `/tickets/${ticket.ticketCode}/print-event`, { format: 'a4' });
  assert.equal(reprint.status, 200);
  assert.equal(reprint.data.data.printType, 'reprint');
});

test('ticket scan is blocked for unauthorized users and wrong department', async () => {
  const { ticket } = await createCoachTicketFixture();

  const loginRes = await request('POST', '/api/auth/login', { identifier: 'construction@vanguard.local', password: process.env.CONSTRUCTION_SEED_PASSWORD || 'dev-construction-password' });
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
