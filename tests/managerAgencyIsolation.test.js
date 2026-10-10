const test = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = require.resolve('../src/config/prisma');
const prismaModule = {};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaModule };
const calls = [];
const department = { id: 'coach-dept', type: 'VANGUARD_COACH' };
const manager = { role: 'MANAGER', departmentId: department.id, department, agencyId: 'agency-a', permissions: ['VIEW_TRIP', 'VIEW_RESERVATION', 'VIEW_PAYMENT', 'VIEW_TICKET_SCAN'] };

test.before(() => {
  prismaModule.department = { findUnique: async () => department };
  prismaModule.trip = {
    findMany: async (args) => { calls.push({ model: 'trip', method: 'findMany', args }); return []; },
    count: async (args) => { calls.push({ model: 'trip', method: 'count', args }); return 0; },
    findUnique: async () => ({ id: 'trip-b', schedule: { departmentId: department.id, agencyId: 'agency-b', bus: { seats: 20 } }, reservations: [] }),
  };
  prismaModule.payment = {
    findMany: async (args) => { calls.push({ model: 'payment', method: 'findMany', args }); return []; },
    count: async (args) => { calls.push({ model: 'payment', method: 'count', args }); return 0; },
  };
  prismaModule.ticket = {
    findMany: async (args) => { calls.push({ model: 'ticket', method: 'findMany', args }); return []; },
    count: async (args) => { calls.push({ model: 'ticket', method: 'count', args }); return 0; },
  };
  prismaModule.ticketScan = {
    findMany: async (args) => { calls.push({ model: 'ticketScan', method: 'findMany', args }); return []; },
    count: async (args) => { calls.push({ model: 'ticketScan', method: 'count', args }); return 0; },
  };
  prismaModule.serviceSettings = { findUnique: async () => ({ currency: 'USD' }) };
  prismaModule.agency = {
    findMany: async (args) => { calls.push({ model: 'agency', method: 'findMany', args }); return []; },
    count: async (args) => { calls.push({ model: 'agency', method: 'count', args }); return 0; },
    findUnique: async () => ({ id: 'agency-b', departmentId: department.id }),
  };
  prismaModule.parcel = {
    findMany: async (args) => { calls.push({ model: 'parcel', method: 'findMany', args }); return []; },
    count: async (args) => { calls.push({ model: 'parcel', method: 'count', args }); return 0; },
    findUnique: async () => ({ id: 'parcel-b', originAgencyId: 'agency-b', destinationAgencyId: 'agency-c', status: 'REGISTERED' }),
  };
  prismaModule.reservation = {
    findMany: async (args) => { calls.push({ model: 'reservation', method: 'findMany', args }); return []; },
    count: async (args) => { calls.push({ model: 'reservation', method: 'count', args }); return 0; },
    findUnique: async ({ where }) => where.id === 'reservation-mismatch'
      ? ({ id: where.id, agencyId: 'agency-a', trip: { schedule: { departmentId: department.id, agencyId: 'agency-b' } }, payments: [], tickets: [] })
      : ({ id: 'reservation-b', agencyId: 'agency-b', trip: { schedule: { departmentId: department.id, agencyId: 'agency-b' } }, payments: [], tickets: [] }),
  };
});

test.beforeEach(() => { calls.length = 0; });

test('Manager trip listing is scoped to the authenticated agency', async () => {
  const service = require('../src/services/tripService');
  await service.listTrips({}, manager);
  const query = calls.find(({ model, method }) => model === 'trip' && method === 'findMany');
  assert.equal(query.args.where.schedule.departmentId, department.id);
  assert.equal(query.args.where.schedule.agencyId, manager.agencyId);
});

test('Manager cannot open a trip from another agency by ID', async () => {
  const service = require('../src/services/tripService');
  await assert.rejects(service.getTripById('trip-b', manager), { statusCode: 403 });
});

test('Manager reservation listing excludes reservations associated with another agency', async () => {
  const service = require('../src/services/reservationService');
  await service.listReservations({}, manager);
  const query = calls.find(({ model, method }) => model === 'reservation' && method === 'findMany');
  assert.equal(JSON.stringify(query.args.where).includes(manager.agencyId), true);
  assert.equal(JSON.stringify(query.args.where).includes('agency-b'), false);
});

test('Manager cannot open a reservation from another agency or contradictory agency relations by ID', async () => {
  const service = require('../src/services/reservationService');
  await assert.rejects(service.getReservationById('reservation-b', manager), { statusCode: 403 });
  await assert.rejects(service.getReservationById('reservation-mismatch', manager), { statusCode: 403 });
});

test('Manager parcel listing is limited to parcels touching the assigned agency', async () => {
  const service = require('../src/services/parcelService');
  await service.listParcels({}, manager);
  const query = calls.find(({ model, method }) => model === 'parcel' && method === 'findMany');
  assert.equal(JSON.stringify(query.args.where).includes(manager.agencyId), true);
  assert.equal(JSON.stringify(query.args.where).includes('agency-b'), false);
});

test('Manager cannot read or edit a parcel from another agency by ID', async () => {
  const service = require('../src/services/parcelService');
  await assert.rejects(service.getParcelById('parcel-b', manager), { statusCode: 403 });
  await assert.rejects(service.updateParcel('parcel-b', { senderEmail: 'changed@example.test' }, manager), { statusCode: 403 });
});

test('Manager cannot forge a different parcel origin agency', () => {
  const service = require('../src/services/parcelService');
  assert.throws(() => service.resolveOriginAgencyId('agency-b', manager), { statusCode: 403 });
});

test('Manager agency listing is limited to the authenticated agency', async () => {
  const service = require('../src/services/agencyService');
  await service.listAgencies({}, manager);
  const query = calls.find(({ model, method }) => model === 'agency' && method === 'findMany');
  assert.equal(query.args.where.departmentId, department.id);
  assert.equal(query.args.where.id, manager.agencyId);
});

test('Manager cannot open another agency by ID', async () => {
  const service = require('../src/services/agencyService');
  await assert.rejects(service.getAgencyById('agency-b', manager), { statusCode: 403 });
});

test('Manager pending reservation payments are scoped to the authenticated agency', async () => {
  const service = require('../src/services/reservationPaymentService');
  await service.listPendingReservationPayments({}, manager);
  const query = calls.find(({ model, method }) => model === 'payment' && method === 'findMany');
  assert.equal(JSON.stringify(query.args.where).includes(manager.agencyId), true);
  assert.equal(JSON.stringify(query.args.where).includes('agency-b'), false);
});

test('Manager ticket and scan lists retain the authenticated agency filter', async () => {
  const service = require('../src/services/ticketService');
  await service.listTickets({}, manager);
  await service.listTicketScans({}, manager);
  for (const call of calls.filter(({ model, method }) => ['ticket', 'ticketScan'].includes(model) && method === 'findMany')) {
    assert.equal(JSON.stringify(call.args.where).includes(manager.agencyId), true);
    assert.equal(JSON.stringify(call.args.where).includes('agency-b'), false);
  }
});
