const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'test-jwt-secret-that-is-at-least-thirty-two-characters';
process.env.SESSION_SECRET ||= 'test-session-secret-that-is-at-least-thirty-two-characters';
process.env.TICKET_QR_SECRET ||= 'test-ticket-qr-secret-that-is-at-least-thirty-two-characters';
process.env.DATABASE_URL ||= 'postgresql://vanguard:test@127.0.0.1:5432/vanguard_test';

const prisma = require('../src/config/prisma');
const service = require('../src/services/publicTransportService');
const { AppError, errorHandler } = require('../src/middleware/errorHandler');

const makeEligibleTrip = (overrides = {}) => ({
  id: 'trip-public-test',
  scheduleId: 'schedule-public-test',
  status: 'SCHEDULED',
  departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  schedule: {
    departmentId: 'coach-department',
    agencyId: 'agency-public-test',
    status: 'ACTIVE',
    price: '25.00',
    bus: { id: 'bus-public-test', seats: 2, status: 'ACTIVE' },
    route: { id: 'route-public-test', status: 'ACTIVE' },
  },
  ...overrides,
});

const withReservationMocks = async (options, run) => {
  const originals = {
    tripFindUnique: prisma.trip.findUnique,
    agencyFindUnique: prisma.agency.findUnique,
    transaction: prisma.$transaction,
  };
  try {
    prisma.trip.findUnique = async () => options.trip ?? makeEligibleTrip();
    prisma.agency.findUnique = async () => ({ id: 'agency-public-test', isActive: true });
    prisma.$transaction = async (callback) => callback({
      reservation: { create: options.createReservation || (async ({ data }) => ({ id: 'reservation-created', ...data })) },
      serviceSettings: { findUnique: options.findSettings || (async () => null) },
      payment: { create: options.createPayment || (async ({ data }) => ({ id: 'payment-created', createdAt: new Date(), ...data })) },
    });
    return await run();
  } finally {
    prisma.trip.findUnique = originals.tripFindUnique;
    prisma.agency.findUnique = originals.agencyFindUnique;
    prisma.$transaction = originals.transaction;
  }
};

const booking = { tripId: 'trip-public-test', customerName: 'Test Passenger', customerPhone: '+243812345678', seatNumber: '2' };

test('public reservation creates one pending CASH payment in the displayed default USD currency without a ticket', async () => {
  let createdPayment;
  const result = await withReservationMocks({
    createPayment: async ({ data }) => {
      createdPayment = data;
      return { id: 'payment-created', createdAt: new Date(), ...data };
    },
  }, () => service.createPublicReservation(booking));

  assert.equal(result.reservation.status, 'PENDING');
  assert.equal(result.reservation.totalAmount, '25.00');
  assert.equal(createdPayment.currency, 'USD');
  assert.equal(createdPayment.method, 'CASH');
  assert.equal(createdPayment.channel, 'AGENCY');
  assert.equal(createdPayment.status, 'PENDING');
  assert.equal(Object.hasOwn(result, 'ticket'), false);
});

test('a trip that is no longer publicly bookable returns a safe 409 before creating records', async () => {
  let transactionCalled = false;
  const originals = { tx: prisma.$transaction, trip: prisma.trip.findUnique, agency: prisma.agency.findUnique };
  try {
    prisma.trip.findUnique = async () => makeEligibleTrip({ status: 'CANCELLED' });
    prisma.$transaction = async () => { transactionCalled = true; };
    await assert.rejects(service.createPublicReservation(booking), (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.message, 'Trip is not available');
      return true;
    });
    assert.equal(transactionCalled, false);
  } finally {
    prisma.$transaction = originals.tx;
    prisma.trip.findUnique = originals.trip;
    prisma.agency.findUnique = originals.agency;
  }
});

test('an invalid configured currency fails as a server configuration error, not an HTTP conflict', async () => {
  await assert.rejects(withReservationMocks({
    findSettings: async () => ({ currency: 'EUR' }),
  }, () => service.createPublicReservation(booking)), (error) => {
    assert.equal(error.statusCode, 503);
    assert.equal(error.message, 'Vanguard Coach currency is not configured for reservations');
    return true;
  });
});

test('only an active trip-seat unique collision is reported as an occupied seat', async () => {
  const seatConflict = Object.assign(new Error('database detail'), { code: 'P2002', meta: { target: ['tripId', 'seatNumber'] } });
  await assert.rejects(withReservationMocks({
    createReservation: async () => { throw seatConflict; },
  }, () => service.createPublicReservation(booking)), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.message, 'This seat was just reserved. Please choose another seat.');
    assert.equal(error.message.includes('database detail'), false);
    return true;
  });

  const codeConflict = Object.assign(new Error('database detail'), { code: 'P2002', meta: { target: ['reservationCode'] } });
  await assert.rejects(withReservationMocks({
    createReservation: async () => { throw codeConflict; },
  }, () => service.createPublicReservation(booking)), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.message, 'This reservation conflicts with an existing record. Please refresh and try again.');
    return true;
  });
});

test('production public-reservation conflict logs correlate safe route/message without request data', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousConsoleError = console.error;
  let logged;
  let body;
  const response = {
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { body = value; return this; },
  };
  try {
    process.env.NODE_ENV = 'production';
    console.error = (_prefix, entry) => { logged = entry; };
    errorHandler(
      new AppError('This seat was just reserved. Please choose another seat.', 409),
      {
        method: 'POST',
        originalUrl: '/api/public/reservations?customerPhone=private-phone',
        path: '/api/public/reservations',
        baseUrl: '/api/public',
        route: { path: '/reservations' },
      },
      response,
      () => assert.fail('error handler must end the response'),
    );
  } finally {
    console.error = previousConsoleError;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }

  assert.equal(response.statusCode, 409);
  assert.equal(logged.route, '/api/public/reservations');
  assert.equal(logged.statusCode, 409);
  assert.equal(logged.errorType, 'AppError');
  assert.match(logged.errorId, /^[0-9a-f-]{36}$/i);
  assert.equal(logged.message, 'This seat was just reserved. Please choose another seat.');
  assert.equal(JSON.stringify(logged).includes('private-phone'), false);
  assert.equal(JSON.stringify(body).includes('stack'), false);
});
