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
      const existing = await prisma.rolePermission.findFirst({ where: { roleId: role.id, permissionId: permission.id } });
      if (!existing) {
        const rolePermission = await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
        createdRolePermissionIds.push(rolePermission.id);
      }
    }
  }

  return user;
};

const loginTestUser = async (email, password) => {
  const loginRes = await request('POST', '/api/auth/login', { identifier: email, password });
  assert.equal(loginRes.status, 200);
  return loginRes.data.data.token;
};

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
  if (createdRolePermissionIds.length) {
    await prisma.rolePermission.deleteMany({ where: { id: { in: createdRolePermissionIds } } });
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

const setupCoachReservation = async (adminToken) => {
  const deps = await request('GET', '/api/departments', null, adminToken);
  assert.equal(deps.status, 200);
  const department = deps.data.data.items.find((item) => item.type === 'VANGUARD_COACH');
  assert.ok(department);

  const destinationRes = await request('POST', '/api/destinations', { departmentId: department.id, code: `PAY-${Date.now()}`, departureCity: 'A', arrivalCity: 'B' }, adminToken);
  assert.equal(destinationRes.status, 201);
  const routeId = destinationRes.data.data.route.id;

  const busRes = await request('POST', '/api/buses', { departmentId: department.id, plateNumber: `PAY-${Date.now()}`, brand: 'Coach', model: 'C', seats: 20 }, adminToken);
  assert.equal(busRes.status, 201);
  const busId = busRes.data.data.bus.id;

  const scheduleRes = await request('POST', '/api/schedules', { departmentId: department.id, routeId, busId, departureTime: '09:00', availableDays: ['MON'], price: '15.00' }, adminToken);
  assert.equal(scheduleRes.status, 201);
  const scheduleId = scheduleRes.data.data.schedule.id;

  const now = new Date();
  const departureAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  const arrivalAt = new Date(now.getTime() + 26 * 3600 * 1000).toISOString();

  const tripRes = await request('POST', '/api/trips', { scheduleId, departureAt, arrivalAt }, adminToken);
  assert.equal(tripRes.status, 201);
  const tripId = tripRes.data.data.trip.id;

  const reservationRes = await request('POST', '/api/reservations', { tripId, customerName: 'Payment User', customerPhone: '0700000000', seatNumber: '1' }, adminToken);
  assert.equal(reservationRes.status, 201);
  const reservation = reservationRes.data.data.reservation;
  assert.equal(reservation.status, 'PENDING');

  return { department, tripId, reservation };
};

test('reservation payment confirms coach reservation after validation', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
    reference: 'REF-COACH-01',
  }, adminToken);
  assert.equal(paymentRes.status, 201);
  const payment = paymentRes.data.data.payment;
  assert.equal(payment.status, 'PENDING');
  assert.equal(payment.reference, 'REF-COACH-01');

  const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);
  assert.equal(validateRes.data.data.payment.status, 'VERIFIED');

  const reservationAfterRes = await request('GET', `/api/reservations/${reservation.id}`, null, adminToken);
  assert.equal(reservationAfterRes.status, 200);
  assert.equal(reservationAfterRes.data.data.reservation.status, 'CONFIRMED');

  const listRes = await request('GET', `/api/reservation-payments/reservation/${reservation.id}`, null, adminToken);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.data.data.total, 1);
  assert.equal(listRes.data.data.payments[0].id, payment.id);
});

test('double payment and duplicate validation are rejected correctly', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const payment1Res = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '10.00',
    method: 'CASH',
    reference: 'REF-COACH-01',
  }, adminToken);
  assert.equal(payment1Res.status, 201);
  const payment1 = payment1Res.data.data.payment;

  const payment2Res = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '5.00',
    method: 'CASH',
    reference: 'REF-COACH-02',
  }, adminToken);
  assert.equal(payment2Res.status, 201);
  const payment2 = payment2Res.data.data.payment;

  const validate1Res = await request('POST', `/api/reservation-payments/${payment1.id}/validate`, null, adminToken);
  assert.equal(validate1Res.status, 200);
  assert.equal(validate1Res.data.data.payment.status, 'VERIFIED');

  const duplicateValidate1Res = await request('POST', `/api/reservation-payments/${payment1.id}/validate`, null, adminToken);
  assert.equal(duplicateValidate1Res.status, 409);

  const rejectAfterValidateRes = await request('POST', `/api/reservation-payments/${payment1.id}/reject`, { reason: 'Nope' }, adminToken);
  assert.equal(rejectAfterValidateRes.status, 409);

  const validateAfterRejectRes = await request('POST', `/api/reservation-payments/${payment2.id}/reject`, { reason: 'Bad' }, adminToken);
  assert.equal(validateAfterRejectRes.status, 200);
  assert.equal(validateAfterRejectRes.data.data.payment.status, 'REJECTED');

  const validateRejectedRes = await request('POST', `/api/reservation-payments/${payment2.id}/validate`, null, adminToken);
  assert.equal(validateRejectedRes.status, 409);

  const cancelRejectedRes = await request('POST', `/api/reservation-payments/${payment2.id}/cancel`, null, adminToken);
  assert.equal(cancelRejectedRes.status, 409);

  const reservationAfterRes = await request('GET', `/api/reservations/${reservation.id}`, null, adminToken);
  assert.equal(reservationAfterRes.status, 200);
  assert.equal(reservationAfterRes.data.data.reservation.status, 'CONFIRMED');
});

test('permissions enforce coach department and manage reservation payment rights', async () => {
  const salesperson = await createTestUser({
    email: `coach-${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Coach',
    lastName: 'User',
    roleName: 'SALES_AGENT',
    departmentType: 'VANGUARD_COACH',
    permissions: ['MANAGE_RESERVATION_PAYMENT', 'VIEW_RESERVATION'],
  });
  const coachToken = await loginTestUser(salesperson.email, 'Password123!');

  const nonPermUser = await createTestUser({
    email: `noperm-${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'NoPerm',
    lastName: 'User',
    roleName: 'MANAGER',
    departmentType: 'VANGUARD_COACH',
  });
  const noPermToken = await loginTestUser(nonPermUser.email, 'Password123!');

  const outsider = await createTestUser({
    email: `outsider-${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Outsider',
    lastName: 'User',
    roleName: 'SALES_AGENT',
    departmentType: 'AUTO_SALES',
    permissions: ['MANAGE_RESERVATION_PAYMENT', 'VIEW_RESERVATION'],
  });
  const outsiderToken = await loginTestUser(outsider.email, 'Password123!');

  const { reservation } = await setupCoachReservation(adminToken);

  const coachPaymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, coachToken);
  assert.equal(coachPaymentRes.status, 201);
  const payment = coachPaymentRes.data.data.payment;

  const noPermPaymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, noPermToken);
  assert.equal(noPermPaymentRes.status, 403);

  const outsiderPaymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, outsiderToken);
  assert.equal(outsiderPaymentRes.status, 403);

  const coachValidateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, coachToken);
  assert.equal(coachValidateRes.status, 200);
  assert.equal(coachValidateRes.data.data.payment.status, 'VERIFIED');
});

const getTicketCountForReservation = async (reservationId) => prisma.ticket.count({ where: { reservationId } });

const getTicketFromPublicRoute = async (ticketCode) => {
  const res = await fetch(`${baseUrl}/tickets/${ticketCode}`);
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { status: res.status, data };
};

const getTicketPrintPage = async (ticketCode, token = null) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${baseUrl}/api/tickets/${ticketCode}/print`, { headers });
  const text = await res.text();
  return { status: res.status, text };
};

test('validated payment stores validatedById and validatedAt correctly', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
    reference: 'REF-COACH-VALID',
  }, adminToken);
  assert.equal(paymentRes.status, 201);
  const payment = paymentRes.data.data.payment;

  const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);
  const validated = validateRes.data.data.payment;
  assert.equal(validated.status, 'VERIFIED');
  assert.ok(validated.validatedById);
  assert.ok(validated.validatedAt);
  assert.equal(validated.amount, '15.00');
  assert.equal(validated.method, 'CASH');
  assert.equal(validated.reservationId, reservation.id);
  assert.equal(validated.reference, 'REF-COACH-VALID');
});

test('reservation without validated payment cannot generate ticket', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const ticketRes = await request('POST', '/api/tickets', { reservationId: reservation.id }, adminToken);
  assert.equal(ticketRes.status, 409);
});

test('ticket is automatically generated after payment validation', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(paymentRes.status, 201);
  const payment = paymentRes.data.data.payment;

  const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);
  assert.equal(validateRes.data.data.payment.status, 'VERIFIED');
  assert.ok(validateRes.data.data.ticket);
  assert.equal(validateRes.data.data.ticket.reservationId, reservation.id);
  assert.equal(validateRes.data.data.ticket.status, 'VALID');
  assert.ok(validateRes.data.data.ticket.qrCode.startsWith('vanguard://ticket/'));

  const ticketCount = await getTicketCountForReservation(reservation.id);
  assert.equal(ticketCount, 1);
});

test('second payment validation does not create a duplicate ticket', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(paymentRes.status, 201);
  const payment = paymentRes.data.data.payment;

  const validateRes1 = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes1.status, 200);
  const countAfterFirst = await getTicketCountForReservation(reservation.id);
  assert.equal(countAfterFirst, 1);

  const validateRes2 = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes2.status, 409);

  const countAfterSecond = await getTicketCountForReservation(reservation.id);
  assert.equal(countAfterSecond, 1);
});

test('ticket is linked to the correct reservation and provides public access', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(paymentRes.status, 201);
  const payment = paymentRes.data.data.payment;

  const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);
  const ticket = validateRes.data.data.ticket;

  assert.equal(ticket.reservationId, reservation.id);
  assert.equal(ticket.reservation.customerName, 'Payment User');
  assert.equal(ticket.reservation.customerPhone, '0700000000');
  assert.equal(ticket.reservation.seatNumber, '1');
  assert.ok(ticket.ticketCode);
  assert.ok(ticket.serialNumber);
  assert.ok(ticket.qrCode);
  assert.equal(ticket.status, 'VALID');
  assert.ok(ticket.reservation.trip);
  assert.ok(ticket.reservation.trip.schedule);
  assert.ok(ticket.reservation.trip.schedule.route);
  assert.ok(ticket.reservation.trip.schedule.bus);

  const publicRes = await getTicketFromPublicRoute(ticket.ticketCode);
  assert.equal(publicRes.status, 200);
  const publicTicket = publicRes.data.data.ticket;
  assert.equal(publicTicket.ticketCode, ticket.ticketCode);
  assert.equal(publicTicket.qrCode, ticket.qrCode);
  assert.equal(publicTicket.reservation.id, reservation.id);
});

test('ticket public route rejects slightly modified ticketCode', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(paymentRes.status, 201);
  const payment = paymentRes.data.data.payment;

  const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);
  const ticket = validateRes.data.data.ticket;

  const modifiedCode = ticket.ticketCode.replace(/.$/, (char) => String.fromCharCode(char.charCodeAt(0) + 1));
  const modifiedRes = await getTicketFromPublicRoute(modifiedCode);
  assert.equal(modifiedRes.status, 404);
});

test('ticket public route is accessible without auth and invalid ticket is rejected', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(paymentRes.status, 201);
  const payment = paymentRes.data.data.payment;

  const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);
  const ticket = validateRes.data.data.ticket;

  const publicRes = await getTicketFromPublicRoute(ticket.ticketCode);
  assert.equal(publicRes.status, 200);

  const invalidPublicRes = await getTicketFromPublicRoute('NON_EXISTENT_CODE');
  assert.equal(invalidPublicRes.status, 404);
});

test('used ticket is still consultable and clearly marked used', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(paymentRes.status, 201);
  const payment = paymentRes.data.data.payment;

  const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);
  const ticket = validateRes.data.data.ticket;

  await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'USED' } });

  const publicRes = await getTicketFromPublicRoute(ticket.ticketCode);
  assert.equal(publicRes.status, 200);
  assert.equal(publicRes.data.data.ticket.status, 'USED');
  assert.notEqual(publicRes.data.data.ticket.status, 'VALID');
});

test('public ticket response does not expose internal issuedBy user data', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(paymentRes.status, 201);
  const payment = paymentRes.data.data.payment;

  const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);
  const ticket = validateRes.data.data.ticket;

  const publicRes = await getTicketFromPublicRoute(ticket.ticketCode);
  assert.equal(publicRes.status, 200);
  const publicTicket = publicRes.data.data.ticket;
  assert.equal(publicTicket.ticketCode, ticket.ticketCode);
  assert.equal(publicTicket.qrCode, ticket.qrCode);
  assert.equal(publicTicket.reservation.id, reservation.id);
  assert.equal(publicTicket.issuedBy, undefined);
  assert.equal(publicTicket.reservation.createdByUserId, undefined);
});

test('public tickets endpoint does not allow listing or simple enumeration', async () => {
  const listRes = await request('GET', '/tickets', null, null);
  assert.equal(listRes.status, 404);

  const authListRes = await request('GET', '/api/tickets', null, null);
  assert.equal(authListRes.status, 401);
});

test('ticket can be rendered for print and preserves ticket code and qr code', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(paymentRes.status, 201);

  const payment = paymentRes.data.data.payment;
  const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);
  const ticket = validateRes.data.data.ticket;

  const printRes = await getTicketPrintPage(ticket.ticketCode, adminToken);
  assert.equal(printRes.status, 200);
  assert.match(printRes.text, /Vanguard Coach/i);
  assert.match(printRes.text, new RegExp(ticket.ticketCode.replace(/[-/.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(printRes.text, /QR Code|qrcode|qr/i);
  assert.match(printRes.text, new RegExp(ticket.serialNumber.replace(/[-/.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('ticket print route rejects unauthorized access and invalid ticket requests', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(paymentRes.status, 201);

  const payment = paymentRes.data.data.payment;
  const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);
  const ticket = validateRes.data.data.ticket;

  const noTokenRes = await getTicketPrintPage(ticket.ticketCode, null);
  assert.equal(noTokenRes.status, 401);

  const invalidRes = await getTicketPrintPage('NON_EXISTENT_CODE', adminToken);
  assert.equal(invalidRes.status, 404);
});

test('ticket reprint keeps same ticket code and qr code without creating a duplicate', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(paymentRes.status, 201);

  const payment = paymentRes.data.data.payment;
  const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);
  const ticket = validateRes.data.data.ticket;

  const firstPrint = await getTicketPrintPage(ticket.ticketCode, adminToken);
  assert.equal(firstPrint.status, 200);

  const secondPrint = await getTicketPrintPage(ticket.ticketCode, adminToken);
  assert.equal(secondPrint.status, 200);

  const ticketCount = await prisma.ticket.count({ where: { reservationId: reservation.id } });
  assert.equal(ticketCount, 1);

  const refreshedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
  assert.equal(refreshedTicket.ticketCode, ticket.ticketCode);
  assert.equal(refreshedTicket.qrCode, ticket.qrCode);
  assert.match(firstPrint.text, new RegExp(ticket.ticketCode.replace(/[-/.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(secondPrint.text, new RegExp(ticket.ticketCode.replace(/[-/.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('cancelled ticket is not returned as valid', async () => {
  const { reservation } = await setupCoachReservation(adminToken);

  const paymentRes = await request('POST', '/api/reservation-payments', {
    reservationId: reservation.id,
    amount: '15.00',
    method: 'CASH',
  }, adminToken);
  assert.equal(paymentRes.status, 201);
  const payment = paymentRes.data.data.payment;

  const validateRes = await request('POST', `/api/reservation-payments/${payment.id}/validate`, null, adminToken);
  assert.equal(validateRes.status, 200);
  const ticket = validateRes.data.data.ticket;

  await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CANCELLED' } });

  const publicRes = await getTicketFromPublicRoute(ticket.ticketCode);
  assert.equal(publicRes.status, 200);
  assert.equal(publicRes.data.data.ticket.status, 'CANCELLED');
});

