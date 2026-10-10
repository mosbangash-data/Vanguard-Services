const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-thirty-two-characters';
process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-thirty-two-characters';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
process.env.TICKET_QR_SECRET = 'test-ticket-qr-secret-that-is-at-least-thirty-two-characters';
const prisma = require('../src/config/prisma');
const parcelService = require('../src/services/parcelService');

const restore = [];
const replace = (target, key, value) => {
  restore.push([target, key, target[key]]);
  target[key] = value;
};

test.afterEach(() => {
  while (restore.length) {
    const [target, key, value] = restore.pop();
    target[key] = value;
  }
});

const destinationAgent = {
  id: 'agent-destination',
  role: 'AGENT',
  agencyId: 'agency-destination',
  department: { type: 'VANGUARD_COACH' },
  permissions: ['RECEIVE_PARCEL', 'CHANGE_PARCEL_STATUS', 'VERIFY_PARCEL_PAYMENT', 'COLLECT_PARCEL'],
};

test('parcel logistics transitions keep finance out and require the arrival and handover actions', async () => {
  assert.deepEqual(parcelService.ALLOWED_PARCEL_TRANSITIONS.REGISTERED, ['ACCEPTED', 'CANCELLED']);
  assert.ok(!parcelService.ALLOWED_PARCEL_TRANSITIONS.REGISTERED.includes('IN_TRANSIT'));
  assert.ok(!parcelService.ALLOWED_PARCEL_TRANSITIONS.ARRIVED_AT_AGENCY.includes('COLLECTED'));
  await assert.rejects(parcelService.changeParcelStatus('p1', { newStatus: 'ARRIVED_AT_AGENCY' }, destinationAgent), { statusCode: 400 });
  await assert.rejects(parcelService.changeParcelStatus('p1', { newStatus: 'PAID' }, destinationAgent), { statusCode: 400 });
});

test('destination actions require an exact assigned destination agency', () => {
  const parcel = { originAgencyId: 'agency-origin', destinationAgencyId: 'agency-destination' };
  assert.doesNotThrow(() => parcelService.assertParcelAgencyAccess(destinationAgent, parcel, 'arrival'));
  assert.throws(() => parcelService.assertParcelAgencyAccess({ ...destinationAgent, agencyId: 'agency-other' }, parcel, 'arrival'), { statusCode: 403 });
  assert.throws(() => parcelService.assertParcelAgencyAccess(destinationAgent, { ...parcel, destinationAgencyId: null }, 'arrival'), { statusCode: 403 });
  assert.throws(() => parcelService.assertParcelAgencyAccess(destinationAgent, { originAgencyId: null, destinationAgencyId: null }, 'view'), { statusCode: 403 });
});

test('destination receipt action requires the dedicated RECEIVE_PARCEL permission', async () => {
  await assert.rejects(parcelService.receiveParcel('p1', { ...destinationAgent, permissions: ['CHANGE_PARCEL_STATUS'] }), { statusCode: 403 });
});

test('pickup cannot auto-collect pending cash', async () => {
  replace(prisma.parcel, 'findUnique', async () => ({
    id: 'p1', status: 'READY_FOR_PICKUP', originAgencyId: 'agency-origin', destinationAgencyId: 'agency-destination', amount: '25.00', currency: 'USD',
  }));
  let parcelUpdates = 0;
  replace(prisma, '$transaction', async (callback) => callback({
    payment: { findMany: async () => [{ id: 'cash-1', method: 'CASH', status: 'PENDING', amount: '25.00', currency: 'USD' }] },
    parcel: { updateMany: async () => { parcelUpdates += 1; return { count: 1 }; } },
  }));
  await assert.rejects(parcelService.collectParcel('p1', {
    collectorName: 'Recipient', collectorPhone: '555', idType: 'ID', idNumber: '1234',
  }, destinationAgent), { statusCode: 409 });
  assert.equal(parcelUpdates, 0);
});

test('pickup requires READY_FOR_PICKUP and does not accept a direct arrival handover', async () => {
  replace(prisma.parcel, 'findUnique', async () => ({
    id: 'p1', status: 'ARRIVED_AT_AGENCY', originAgencyId: 'agency-origin', destinationAgencyId: 'agency-destination', amount: '25.00', currency: 'USD',
  }));
  await assert.rejects(parcelService.collectParcel('p1', {
    collectorName: 'Recipient', collectorPhone: '555', idType: 'ID', idNumber: '1234',
  }, destinationAgent), { statusCode: 409 });
});

test('receipt accepts supported paper formats and rejects unknown formats', () => {
  for (const format of ['a4', '58mm', '80mm', '110mm']) {
    assert.equal(parcelService.normalizeParcelReceiptFormat(format.toUpperCase()), format);
  }
  assert.throws(() => parcelService.normalizeParcelReceiptFormat('letter'), { statusCode: 400 });
  assert.throws(() => parcelService.normalizeParcelReceiptFormat(''), { statusCode: 400 });
});
