const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-thirty-two-characters';
process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-thirty-two-characters';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
process.env.TICKET_QR_SECRET = 'test-ticket-qr-secret-that-is-at-least-thirty-two-characters';
const { resolveOriginAgencyId, resolvePricingDimensions } = require('../src/services/parcelService');

test('agent parcel origin agency is taken from the authenticated account', () => {
  const agent = { id: 'agent-1', role: 'AGENT', agencyId: 'agency-x' };
  assert.equal(resolveOriginAgencyId(undefined, agent), 'agency-x');
  assert.equal(resolveOriginAgencyId('agency-x', agent), 'agency-x');
  assert.throws(() => resolveOriginAgencyId('agency-y', agent), { statusCode: 403 });
  assert.throws(() => resolveOriginAgencyId(undefined, { ...agent, agencyId: null }), { statusCode: 403 });
});

test('parcel pricing enforces selected dimension and excludes the other metric', () => {
  assert.deepEqual(resolvePricingDimensions('WEIGHT', 3, 0.8), { weightKg: 3, volumeM3: 0 });
  assert.deepEqual(resolvePricingDimensions('VOLUME', 20, 0.11), { weightKg: 0, volumeM3: 0.11 });
  assert.throws(() => resolvePricingDimensions('WEIGHT', undefined, 0.2), { statusCode: 400 });
  assert.throws(() => resolvePricingDimensions('VOLUME', 1, -0.2), { statusCode: 400 });
  assert.throws(() => resolvePricingDimensions('UNSUPPORTED', 1, 0.1), { statusCode: 400 });
});
