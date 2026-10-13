const test = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = require.resolve('../src/config/prisma');
const prismaModule = {};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaModule };
const originalPrisma = { ...prismaModule };
const calls = [];
const record = (model, method, result) => async (args = {}) => { calls.push({ model, method, args }); return typeof result === 'function' ? result(args) : result; };

test.before(() => {
  prismaModule.department = { findUnique: record('department', 'findUnique', { id: 'dept-coach', name: 'Coach', type: 'VANGUARD_COACH' }) };
  prismaModule.agency = {
    findFirst: record('agency', 'findFirst', { id: 'agency-a' }),
    findMany: record('agency', 'findMany', [{ id: 'agency-a', name: 'Agence A', code: 'A' }]),
  };
  prismaModule.trip = { findMany: record('trip', 'findMany', []), count: record('trip', 'count', 0) };
  prismaModule.reservation = { count: record('reservation', 'count', ({ where }) => {
    if (where.createdAt && where.status === 'PENDING') return 2;
    if (where.createdAt && where.status === 'CONFIRMED') return 3;
    if (where.createdAt && where.status === 'CANCELLED') return 1;
    if (where.createdAt) return 6;
    return where.status === 'PENDING' ? 5 : 0;
  }), findMany: record('reservation', 'findMany', []), groupBy: record('reservation', 'groupBy', []) };
  prismaModule.payment = {
    count: record('payment', 'count', ({ where }) => where.parcel ? 1 : 2),
    findMany: record('payment', 'findMany', []),
    groupBy: async (args = {}) => {
      calls.push({ model: 'payment', method: 'groupBy', args });
      if (args.by?.includes('channel')) return [
        { channel: 'AGENCY', method: 'CASH', status: 'PENDING', _count: { _all: 2 } },
        { channel: 'ONLINE', method: 'CARD', status: 'PROCESSING', _count: { _all: 3 } },
      ];
      if (args.where?.validatedAt) {
        return args.where?.parcel
          ? [{ currency: 'USD', _sum: { amount: 40 } }, { currency: 'CDF', _sum: { amount: 100 } }]
          : [{ currency: 'USD', _sum: { amount: 50 } }, { currency: 'CDF', _sum: { amount: 20 } }];
      }
      if (args.where?.status?.in) return [{ currency: 'USD', _sum: { amount: 80 } }];
      return [{ currency: 'USD', _sum: { amount: 25 } }];
    },
  };
  prismaModule.parcel = { count: record('parcel', 'count', ({ where }) => (where.status?.in ? 4 : 0)), findMany: record('parcel', 'findMany', []) };
  prismaModule.user = { groupBy: record('user', 'groupBy', []) };
  prismaModule.ticket = { groupBy: record('ticket', 'groupBy', []) };
  prismaModule.ticketScan = { findMany: record('ticketScan', 'findMany', []) };
});

test.after(() => {
  for (const [key, value] of Object.entries(originalPrisma)) prismaModule[key] = value;
});

test.beforeEach(() => { calls.length = 0; });

test('Manager dashboard rejects operational roles without department supervision access', async () => {
  const service = require('../src/services/managerDashboardService');
  await assert.rejects(service.getManagerDashboard({ role: 'AGENT', department: { type: 'VANGUARD_COACH' } }), { statusCode: 403 });
  assert.equal(calls.length, 0);
});

test('Manager dashboard derives department and agency filters from the authenticated user', async () => {
  const service = require('../src/services/managerDashboardService');
  const result = await service.getManagerDashboard({ role: 'MANAGER', departmentId: 'dept-coach', department: { id: 'dept-coach', type: 'VANGUARD_COACH' }, agencyId: 'agency-a', permissions: ['VIEW_TRIP', 'VIEW_RESERVATION', 'VIEW_PAYMENT', 'VIEW_PARCEL', 'VIEW_PARCEL_PAYMENT', 'VERIFY_PARCEL_PAYMENT', 'VIEW_USER'] });
  assert.equal(result.scope.departmentId, 'dept-coach');
  assert.equal(result.scope.agencyId, 'agency-a');
  const todayTrips = calls.find((call) => call.model === 'trip' && call.method === 'findMany');
  assert.equal(todayTrips.args.where.schedule.departmentId, 'dept-coach');
  assert.equal(todayTrips.args.where.schedule.agencyId, 'agency-a');
  assert.equal(calls.find((call) => call.model === 'agency' && call.method === 'findFirst').args.where.isActive, true);
  const reservationQuery = calls.find((call) => call.model === 'reservation' && call.method === 'findMany');
  assert.equal(JSON.stringify(reservationQuery.args.where).includes('dept-coach'), true);
  assert.equal(JSON.stringify(reservationQuery.args.where).includes('agency-a'), true);
  assert.deepEqual(result.kpis.revenue, { USD: 80 });
  assert.deepEqual(result.kpis.todayReservationRevenue, { USD: 50, CDF: 20 });
  assert.deepEqual(result.kpis.todayParcelRevenue, { USD: 40, CDF: 100 });
  assert.deepEqual(result.kpis.todayRevenue, { USD: 90, CDF: 120 });
  assert.equal(result.kpis.todayReservations, 6);
  assert.equal(result.kpis.todayPendingReservations, 2);
  assert.equal(result.kpis.todayConfirmedReservations, 3);
  assert.equal(result.kpis.todayCancelledReservations, 1);
  assert.equal(result.kpis.pendingPayments, 3);
  assert.deepEqual(result.kpis.pendingPaymentAmount, { USD: 50 });
  assert.deepEqual(result.kpis.pendingReservationPaymentAmount, { USD: 25 });
  assert.deepEqual(result.kpis.pendingParcelPaymentAmount, { USD: 25 });
  assert.equal(result.kpis.pendingCashToValidate, 1);
  assert.equal(result.kpis.pendingOnline, 3);
  assert.equal(result.kpis.parcelsAwaitingPickup, 4);
  const pickupQuery = calls.find((call) => call.model === 'parcel' && call.method === 'count' && call.args.where.status?.in);
  assert.deepEqual(pickupQuery.args.where.destinationAgencyId, 'agency-a');
  assert.deepEqual(pickupQuery.args.where.status.in, ['ARRIVED_AT_AGENCY', 'READY_FOR_PICKUP']);
  const dailyQueries = calls.filter((call) => call.model === 'payment' && call.method === 'groupBy' && call.args.where.validatedAt);
  assert.equal(dailyQueries.length, 2);
  const { businessDayRange, dateKeyAt } = require('../src/utils/businessTime');
  const expectedRange = businessDayRange(dateKeyAt(new Date()));
  for (const query of dailyQueries) {
    assert.deepEqual(query.args.where.status.in, ['VERIFIED', 'COMPLETED']);
    assert.equal(query.args.where.validatedAt.gte.getTime(), expectedRange.start.getTime());
    assert.equal(query.args.where.validatedAt.lt.getTime(), expectedRange.end.getTime());
  }
  assert.deepEqual(result.operations.todayTrips, []);
});

test('Manager agency assignment outside the authenticated department is refused', async () => {
  prismaModule.agency.findFirst = record('agency', 'findFirst', null);
  const service = require('../src/services/managerDashboardService');
  await assert.rejects(service.getManagerDashboard({ role: 'MANAGER', departmentId: 'dept-coach', department: { type: 'VANGUARD_COACH' }, agencyId: 'foreign-agency', permissions: ['VIEW_TRIP'] }), { statusCode: 403 });
});

test('Vanguard Coach Service Admin receives department-wide scope', async () => {
  prismaModule.agency.findFirst = record('agency', 'findFirst', null);
  const service = require('../src/services/managerDashboardService');
  const result = await service.getManagerDashboard({ role: 'SERVICE_ADMIN', departmentId: 'dept-coach', department: { type: 'VANGUARD_COACH' }, agencyId: 'agency-a', permissions: ['VIEW_TRIP', 'VIEW_RESERVATION', 'VIEW_PAYMENT', 'VIEW_PARCEL', 'VIEW_PARCEL_PAYMENT', 'VIEW_USER'] });
  assert.equal(result.scope.departmentId, 'dept-coach');
  assert.equal(result.scope.agencyId, null);
  assert.equal(calls.some((call) => call.model === 'agency' && call.method === 'findFirst'), false);
  const tripQuery = calls.filter((call) => call.model === 'trip' && call.method === 'findMany').at(-1);
  assert.equal(tripQuery.args.where.schedule.departmentId, 'dept-coach');
  assert.equal(Object.hasOwn(tripQuery.args.where.schedule, 'agencyId'), false);
});

test('A Coach dashboard request from another department is refused', async () => {
  const service = require('../src/services/managerDashboardService');
  await assert.rejects(service.getManagerDashboard({ role: 'MANAGER', departmentId: 'dept-construction', department: { type: 'CONSTRUCTION' }, agencyId: 'agency-a', permissions: ['VIEW_TRIP'] }), { statusCode: 403 });
});

test('A Manager without dashboard read permissions is refused', async () => {
  const service = require('../src/services/managerDashboardService');
  await assert.rejects(service.getManagerDashboard({ role: 'MANAGER', departmentId: 'dept-coach', department: { type: 'VANGUARD_COACH' }, agencyId: 'agency-a', permissions: [] }), { statusCode: 403 });
});

test('Manager without an agency is denied before any dashboard query can become global', async () => {
  const service = require('../src/services/managerDashboardService');
  await assert.rejects(service.getManagerDashboard({ role: 'MANAGER', departmentId: 'dept-coach', department: { id: 'dept-coach', type: 'VANGUARD_COACH' }, permissions: ['VIEW_TRIP'] }), { statusCode: 403 });
  assert.equal(calls.length, 0);
});
