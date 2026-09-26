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
  prismaModule.reservation = { count: record('reservation', 'count', 0), findMany: record('reservation', 'findMany', []), groupBy: record('reservation', 'groupBy', []) };
  prismaModule.payment = {
    count: record('payment', 'count', ({ where }) => where.parcel ? 1 : 2),
    findMany: record('payment', 'findMany', []),
    groupBy: async (args = {}) => {
      calls.push({ model: 'payment', method: 'groupBy', args });
      if (args.where?.status?.in) return [{ currency: 'USD', _sum: { amount: 80 } }];
      return [{ currency: 'USD', _sum: { amount: 25 } }];
    },
  };
  prismaModule.parcel = { count: record('parcel', 'count', 0), findMany: record('parcel', 'findMany', []) };
  prismaModule.user = { groupBy: record('user', 'groupBy', []) };
});

test.after(() => {
  for (const [key, value] of Object.entries(originalPrisma)) prismaModule[key] = value;
});

test('Manager dashboard rejects non-manager roles', async () => {
  const service = require('../src/services/managerDashboardService');
  await assert.rejects(service.getManagerDashboard({ role: 'SERVICE_ADMIN', department: { type: 'VANGUARD_COACH' } }), { statusCode: 403 });
  assert.equal(calls.length, 0);
});

test('Manager dashboard derives department and agency filters from the authenticated user', async () => {
  const service = require('../src/services/managerDashboardService');
  const result = await service.getManagerDashboard({ role: 'MANAGER', departmentId: 'dept-coach', department: { id: 'dept-coach', type: 'VANGUARD_COACH' }, agencyId: 'agency-a', permissions: ['VIEW_TRIP', 'VIEW_RESERVATION', 'VIEW_PAYMENT', 'VIEW_PARCEL', 'VIEW_PARCEL_PAYMENT', 'VIEW_USER'] });
  assert.equal(result.scope.departmentId, 'dept-coach');
  assert.equal(result.scope.agencyId, 'agency-a');
  const todayTrips = calls.find((call) => call.model === 'trip' && call.method === 'findMany');
  assert.equal(todayTrips.args.where.schedule.departmentId, 'dept-coach');
  assert.equal(todayTrips.args.where.schedule.agencyId, 'agency-a');
  const reservationQuery = calls.find((call) => call.model === 'reservation' && call.method === 'findMany');
  assert.equal(reservationQuery.args.where.trip.schedule.departmentId, 'dept-coach');
  assert.deepEqual(result.kpis.revenue, { USD: 80 });
  assert.equal(result.kpis.pendingPayments, 3);
  assert.deepEqual(result.kpis.pendingPaymentAmount, { USD: 50 });
  const paidQuery = calls.find((call) => call.model === 'payment' && call.method === 'groupBy' && call.args.where.status?.in);
  assert.deepEqual(paidQuery.args.where.status.in, ['VERIFIED', 'COMPLETED']);
  assert.deepEqual(result.operations.todayTrips, []);
});

test('Manager agency assignment outside the authenticated department is refused', async () => {
  prismaModule.agency.findFirst = record('agency', 'findFirst', null);
  const service = require('../src/services/managerDashboardService');
  await assert.rejects(service.getManagerDashboard({ role: 'MANAGER', departmentId: 'dept-coach', department: { type: 'VANGUARD_COACH' }, agencyId: 'foreign-agency', permissions: ['VIEW_TRIP'] }), { statusCode: 403 });
});
