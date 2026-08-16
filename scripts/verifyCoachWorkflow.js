const http = require('http');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const marker = `WF-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
let server;

const request = async (baseUrl, method, path, body, token) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, data, text };
};

const expect = (result, status, label) => {
  if (result.status !== status) throw new Error(`${label}: expected HTTP ${status}, got ${result.status}: ${JSON.stringify(result.data)}`);
  return result;
};

const main = async () => {
  const coach = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  const agentRole = await prisma.role.findUnique({ where: { name: 'AGENT' } });
  if (!coach || !agentRole) throw new Error('Vanguard Coach department or AGENT role is missing');

  await prisma.serviceSettings.upsert({
    where: { departmentId: coach.id },
    update: { currency: 'USD' },
    create: { departmentId: coach.id, currency: 'USD' },
  });

  const agentEmail = `workflow.agent.${marker.toLowerCase()}@vanguard.local`;
  const agent = await prisma.user.create({
    data: {
      email: agentEmail,
      passwordHash: await bcrypt.hash(`Workflow-${marker}!`, 10),
      firstName: 'Workflow',
      lastName: 'Agent',
      roleId: agentRole.id,
      departmentId: coach.id,
      status: 'ACTIVE',
      firstLogin: false,
    },
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const adminLogin = expect(await request(baseUrl, 'POST', '/api/auth/login', { identifier: 'admin@vanguard.local', password: 'Admin123!' }), 200, 'admin login');
  const adminToken = adminLogin.data.data.token;
  const agentLogin = expect(await request(baseUrl, 'POST', '/api/auth/login', { identifier: agentEmail, password: `Workflow-${marker}!` }), 200, 'agent login');
  const agentToken = agentLogin.data.data.token;
  const constructionLogin = expect(await request(baseUrl, 'POST', '/api/auth/login', { identifier: 'construction@vanguard.local', password: 'Construction123!' }), 200, 'non-scanner login');

  const route = expect(await request(baseUrl, 'POST', '/api/destinations', {
    departmentId: coach.id, code: `${marker}-RT`, departureCity: 'Kinshasa', arrivalCity: 'Lubumbashi',
  }, adminToken), 201, 'route creation').data.data.route;
  const bus = expect(await request(baseUrl, 'POST', '/api/buses', {
    departmentId: coach.id, plateNumber: `${marker}-BUS`, brand: 'Vanguard', model: 'Workflow', seats: 4,
  }, adminToken), 201, 'bus creation').data.data.bus;
  const schedule = expect(await request(baseUrl, 'POST', '/api/schedules', {
    departmentId: coach.id, routeId: route.id, busId: bus.id, departureTime: '08:00', availableDays: ['MON'], price: '25.00',
  }, adminToken), 201, 'schedule creation').data.data.schedule;
  const departureAt = new Date(Date.now() + 86_400_000).toISOString();
  const arrivalAt = new Date(Date.now() + 93_600_000).toISOString();
  const trip = expect(await request(baseUrl, 'POST', '/api/trips', { scheduleId: schedule.id, departureAt, arrivalAt }, adminToken), 201, 'trip creation').data.data.trip;
  const reservation = expect(await request(baseUrl, 'POST', '/api/reservations', {
    tripId: trip.id, customerName: `Workflow Passenger ${marker}`, customerPhone: '0800000000', seatNumber: '1',
  }, adminToken), 201, 'reservation creation').data.data.reservation;
  const payment = expect(await request(baseUrl, 'POST', '/api/reservation-payments', {
    reservationId: reservation.id, amount: '25.00', method: 'CASH', reference: marker,
  }, agentToken), 201, 'payment creation').data.data.payment;

  const pending = expect(await request(baseUrl, 'GET', '/api/reservation-payments?status=PENDING', undefined, agentToken), 200, 'pending payment listing');
  const pendingVisible = pending.data.data.payments.some((item) => item.id === payment.id && item.status === 'PENDING');
  if (!pendingVisible) throw new Error('Created pending payment is not visible to the agent');

  const validation = expect(await request(baseUrl, 'POST', `/api/reservation-payments/${payment.id}/validate`, undefined, agentToken), 200, 'payment validation');
  const ticket = validation.data.data.ticket;
  if (!ticket?.ticketCode || !ticket?.serialNumber || !ticket?.qrCode) throw new Error('Automatic ticket is incomplete');
  const reservationAfterPayment = await prisma.reservation.findUnique({ where: { id: reservation.id } });
  const paymentAfterValidation = await prisma.payment.findUnique({ where: { id: payment.id } });

  const listedTickets = expect(await request(baseUrl, 'GET', `/api/tickets?search=${encodeURIComponent(ticket.ticketCode)}`, undefined, agentToken), 200, 'ticket listing');
  const listedTicket = listedTickets.data.data.tickets.find((item) => item.id === ticket.id);
  if (!listedTicket) throw new Error('Generated ticket is absent from the ticket listing');
  const print = expect(await request(baseUrl, 'GET', `/api/tickets/${ticket.ticketCode}/print`, undefined, agentToken), 200, 'authenticated ticket print');
  const printable = typeof print.text === 'string' && print.text.includes(ticket.ticketCode) && print.text.includes('USD') && !print.text.includes('FCFA');
  if (!printable) throw new Error('Print document does not contain the required ticket/currency data');

  const firstScan = expect(await request(baseUrl, 'POST', '/api/tickets/scan', { qrCode: ticket.qrCode }, agentToken), 200, 'first scan');
  const ticketAfterFirstScan = await prisma.ticket.findUnique({ where: { id: ticket.id } });
  const scansAfterFirstScan = await prisma.ticketScan.findMany({ where: { ticketId: ticket.id }, orderBy: { scannedAt: 'asc' } });
  const secondScan = expect(await request(baseUrl, 'POST', '/api/tickets/scan', { qrCode: ticket.qrCode }, agentToken), 200, 'second scan');
  const scansAfterSecondScan = await prisma.ticketScan.findMany({ where: { ticketId: ticket.id }, orderBy: { scannedAt: 'asc' } });
  const history = expect(await request(baseUrl, 'GET', `/api/tickets/scans?ticketCode=${encodeURIComponent(ticket.ticketCode)}`, undefined, agentToken), 200, 'scan history');
  const historyResults = history.data.data.scans.map((scan) => scan.result);

  const permissionScan = await request(baseUrl, 'POST', '/api/tickets/scan', { qrCode: ticket.qrCode }, constructionLogin.data.data.token);
  const permissionHistory = await request(baseUrl, 'GET', '/api/tickets/scans', undefined, constructionLogin.data.data.token);
  const duplicateValidation = await request(baseUrl, 'POST', `/api/reservation-payments/${payment.id}/validate`, undefined, agentToken);
  const uniqueTicketCount = await prisma.ticket.count({ where: { reservationId: reservation.id } });

  console.log(JSON.stringify({
    marker,
    data: { agentId: agent.id, reservationId: reservation.id, paymentId: payment.id, ticketId: ticket.id, ticketCode: ticket.ticketCode },
    statuses: { payment: paymentAfterValidation.status, reservation: reservationAfterPayment.status, ticketBeforeScan: ticket.status, ticketAfterFirstScan: ticketAfterFirstScan.status },
    checks: {
      pendingVisible,
      ticketListed: Boolean(listedTicket),
      ticketRelation: listedTicket?.reservationId === reservation.id,
      uniqueTicketCount,
      qrAvailable: Boolean(ticket.qrCode),
      currency: listedTickets.data.data.currency,
      printable,
      firstScan: { valid: firstScan.data.valid, status: firstScan.data.status, message: firstScan.data.message },
      scansAfterFirstScan: scansAfterFirstScan.map((scan) => scan.result),
      secondScan: { valid: secondScan.data.valid, status: secondScan.data.status, message: secondScan.data.message },
      scansAfterSecondScan: scansAfterSecondScan.map((scan) => scan.result),
      historyResults,
      permissionScan: permissionScan.status,
      permissionHistory: permissionHistory.status,
      duplicateValidation: duplicateValidation.status,
    },
  }, null, 2));
};

main()
  .catch((error) => { console.error(error.stack || error); process.exitCode = 1; })
  .finally(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  });
