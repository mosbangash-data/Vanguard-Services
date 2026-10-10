const test = require('node:test');
const assert = require('node:assert/strict');

// The service module builds a lazy Prisma client. These test-only credentials
// satisfy env validation; the tested price normalizer makes no database calls.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-thirty-two-characters';
process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-thirty-two-characters';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
process.env.TICKET_QR_SECRET = 'test-ticket-qr-secret-that-is-at-least-thirty-two-characters';

const { resolveManualParcelPrice } = require('../src/services/parcelService');

test.after(async () => {
  const prisma = require('../src/config/prisma');
  await prisma.$disconnect();
});

test('manual parcel price is preserved to cents with its submitted currency', () => {
  assert.deepEqual(resolveManualParcelPrice('25.00', 'CDF', 'USD'), { amount: '25.00', currency: 'CDF' });
});

test('manual parcel price accepts numeric input and defaults only the currency', () => {
  assert.deepEqual(resolveManualParcelPrice(25, undefined, 'CDF'), { amount: '25.00', currency: 'CDF' });
});

test('manual parcel price rejects zero, negative, excessive precision, and overflow', () => {
  for (const value of ['0', '-1', '1.005', '100000000', 'NaN', '']) {
    assert.throws(() => resolveManualParcelPrice(value, 'USD'), (error) => error.statusCode === 400);
  }
});

test('manual parcel price rejects malformed currency codes', () => {
  assert.throws(() => resolveManualParcelPrice('25', 'US'), (error) => error.statusCode === 400);
});
