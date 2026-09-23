const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const prisma = require('../src/config/prisma');
const { main: seedMain } = require('../prisma/seed');
const publicTransportService = require('../src/services/publicTransportService');
const reservationPaymentService = require('../src/services/reservationPaymentService');

const createdIds = {
  agencies: [],
  routes: [],
  buses: [],
  schedules: [],
  trips: [],
  reservations: [],
  payments: [],
  users: [],
};

async function cleanup() {
  await prisma.payment.deleteMany({ where: { id: { in: createdIds.payments } } });
  await prisma.ticket.deleteMany({ where: { reservationId: { in: createdIds.reservations } } });
  await prisma.reservation.deleteMany({ where: { id: { in: createdIds.reservations } } });
  await prisma.trip.deleteMany({ where: { id: { in: createdIds.trips } } });
  await prisma.schedule.deleteMany({ where: { id: { in: createdIds.schedules } } });
  await prisma.route.deleteMany({ where: { id: { in: createdIds.routes } } });
  await prisma.bus.deleteMany({ where: { id: { in: createdIds.buses } } });
  await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
  await prisma.agency.deleteMany({ where: { id: { in: createdIds.agencies } } });
}

async function createTripWithAgency(agencyId) {
  const department = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  assert.ok(department, 'Coach department should exist');

  const route = await prisma.route.create({
    data: {
      departmentId: department.id,
      code: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      departureCity: 'Kinshasa',
      arrivalCity: 'Lubumbashi',
      status: 'ACTIVE',
    },
  });
  createdIds.routes.push(route.id);

  const bus = await prisma.bus.create({
    data: {
      departmentId: department.id,
      plateNumber: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      brand: 'Mercedes',
      model: 'Tourismo',
      seats: 30,
      status: 'ACTIVE',
    },
  });
  createdIds.buses.push(bus.id);

  const schedule = await prisma.schedule.create({
    data: {
      departmentId: department.id,
      routeId: route.id,
      busId: bus.id,
      agencyId,
      departureTime: '08:00',
      availableDays: ['MON', 'TUE'],
      price: '25.00',
      status: 'ACTIVE',
    },
  });
  createdIds.schedules.push(schedule.id);

  const trip = await prisma.trip.create({
    data: {
      scheduleId: schedule.id,
      departureAt: new Date(Date.now() + 60 * 60 * 1000),
      arrivalAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      status: 'SCHEDULED',
    },
  });
  createdIds.trips.push(trip.id);

  return { trip, schedule };
}

async function createAgentUser({ agencyId, email }) {
  const department = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  const role = await prisma.role.findUnique({ where: { name: 'AGENT' } });
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash('Test123!', 10),
      firstName: 'Cash',
      lastName: 'Agent',
      roleId: role.id,
      departmentId: department.id,
      agencyId,
      status: 'ACTIVE',
      firstLogin: false,
    },
  });
  createdIds.users.push(user.id);
  return user;
}

test.before(async () => {
  await seedMain();
});

test.afterEach(async () => {
  await cleanup();
});

test('public reservation keeps the trip agency instead of leaving agencyId null', async () => {
  const department = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  const agency = await prisma.agency.create({
    data: {
      departmentId: department.id,
      code: `CASH-AGENCY-${Date.now()}`,
      name: 'Public Agency',
      city: 'Kinshasa',
    },
  });
  createdIds.agencies.push(agency.id);

  const { trip } = await createTripWithAgency(agency.id);
  const reservation = await publicTransportService.createPublicReservation({
    tripId: trip.id,
    customerName: 'Alice Public',
    customerPhone: '+243812345678',
    customerEmail: 'alice@example.com',
    seatNumber: '1',
  });

  const persisted = await prisma.reservation.findUnique({ where: { id: reservation.reservation.id } });
  assert.equal(persisted.agencyId, agency.id);
});

test('cash payment is tied to reservation agency and rejects mismatched agency validation', async () => {
  const department = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  const agencyA = await prisma.agency.create({
    data: { departmentId: department.id, code: `A-${Date.now()}`, name: 'Agency A', city: 'Kinshasa' },
  });
  const agencyB = await prisma.agency.create({
    data: { departmentId: department.id, code: `B-${Date.now()}`, name: 'Agency B', city: 'Lubumbashi' },
  });
  createdIds.agencies.push(agencyA.id, agencyB.id);

  const { trip } = await createTripWithAgency(agencyA.id);
  const reservation = await prisma.reservation.create({
    data: {
      reservationCode: `RSV-${Date.now()}`,
      tripId: trip.id,
      agencyId: agencyA.id,
      customerName: 'Alice',
      customerPhone: '+243812345679',
      seatNumber: '2',
      totalAmount: '25.00',
      status: 'PENDING',
    },
  });
  createdIds.reservations.push(reservation.id);

  const paymentResponse = await publicTransportService.createPublicReservationPayment(reservation.id, {
    amount: '25.00',
    method: 'CASH',
    reference: 'agency-cash',
    comment: 'pay in agency',
  });

  assert.equal(paymentResponse.payment.channel, 'AGENCY');
  assert.equal(paymentResponse.payment.method, 'CASH');
  assert.equal(paymentResponse.payment.status, 'PENDING');
  assert.equal(paymentResponse.payment.agencyId, agencyA.id);

  const payment = await prisma.payment.findUnique({ where: { id: paymentResponse.payment.id } });
  await prisma.payment.update({ where: { id: payment.id }, data: { agencyId: agencyB.id } });

  const agentUser = await createAgentUser({ agencyId: agencyA.id, email: `cash-agent-${Date.now()}@example.com` });

  await assert.rejects(
    () => reservationPaymentService.validateReservationPayment(payment.id, {
      id: agentUser.id,
      role: 'AGENT',
      agencyId: agencyA.id,
      department: { type: 'VANGUARD_COACH' },
      permissions: ['MANAGE_RESERVATION_PAYMENT'],
    }),
    /same agency|agency|Forbidden|Access denied/i
  );
});
