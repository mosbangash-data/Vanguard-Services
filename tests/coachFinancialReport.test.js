const test = require('node:test');
const assert = require('node:assert/strict');
const { validateFilters, aggregatePayments, classifyPayment } = require('../src/services/coachFinancialReportService');
const { businessDayRange } = require('../src/utils/businessTime');

test('financial report filters require a valid bounded range and allowed enums', () => {
  assert.deepEqual(validateFilters({ startDate: '2026-10-01', endDate: '2026-10-02', currency: 'USD', status: 'VERIFIED', activity: 'PARCEL' }), {
    startDate: '2026-10-01', endDate: '2026-10-02', currency: 'USD', status: 'VERIFIED', activity: 'PARCEL',
  });
  assert.throws(() => validateFilters({ startDate: '2026-02-30', endDate: '2026-03-01' }), /Invalid report date range/);
  assert.throws(() => validateFilters({ startDate: '2025-01-01', endDate: '2026-10-01' }), /exceeds 366 days/);
  assert.throws(() => validateFilters({ startDate: '2026-01-01', endDate: '2026-01-01', currency: 'EUR' }), /Invalid report currency/);
  assert.throws(() => validateFilters({ startDate: '2026-01-01', endDate: '2026-01-01', activity: 'OTHER' }), /Invalid report activity/);
  assert.throws(() => validateFilters({ startDate: '2026-10-02', endDate: '2026-10-01' }), /Invalid report date range/);
  assert.deepEqual(validateFilters({ startDate: '2026-10-01', endDate: '2026-10-02', currency: 'CDF', status: 'PENDING', activity: 'TRANSPORT' }), { startDate: '2026-10-01', endDate: '2026-10-02', currency: 'CDF', status: 'PENDING', activity: 'TRANSPORT' });
});

test('financial aggregation counts each validated transaction once and separates currency and activity', () => {
  const payments = [
    { id: 't1', reservationId: 'r1', parcelId: null, amount: '12.34', currency: 'USD', status: 'VERIFIED', validatedAt: new Date() },
    { id: 'p1', reservationId: null, parcelId: 'c1', amount: '1000.00', currency: 'CDF', status: 'VERIFIED', validatedAt: new Date() },
    { id: 'wait', reservationId: 'r2', parcelId: null, amount: '50', currency: 'USD', status: 'PENDING', createdAt: new Date() },
    { id: 'amb', reservationId: 'r3', parcelId: 'c2', amount: '9', currency: 'USD', status: 'VERIFIED', validatedAt: new Date() },
    { id: 'orphan', reservationId: null, parcelId: null, amount: '9', currency: 'USD', status: 'VERIFIED', validatedAt: new Date() },
    { id: 'done', reservationId: 'r4', parcelId: null, amount: '8', currency: 'USD', status: 'COMPLETED', validatedAt: new Date() },
  ];
  const result = aggregatePayments([...payments, payments[0]]);
  assert.equal(result.totals.TRANSPORT.USD, 1234);
  assert.equal(result.totals.PARCEL.CDF, 100000);
  assert.equal(result.totals.pending.USD, 5000);
  assert.equal(result.validatedPaymentCount, 2);
  assert.equal(result.pendingPaymentCount, 1);
  assert.equal(result.anomalies.ambiguousPayments, 1);
  assert.equal(result.anomalies.unattachedPayments, 1);
  assert.deepEqual(aggregatePayments(payments, 'PENDING', 'TRANSPORT', 'USD').totals.pending, { USD: 5000, CDF: 0 });
});

test('payment relation classification never assigns an ambiguous payment to either activity', () => {
  assert.deepEqual(classifyPayment({ reservationId: 'r', parcelId: 'p' }), { activity: null, anomaly: 'AMBIGUOUS_RELATION' });
  assert.deepEqual(classifyPayment({}), { activity: null, anomaly: 'UNATTACHED_PAYMENT' });
  assert.deepEqual(classifyPayment({ parcelId: 'p' }), { activity: 'PARCEL', anomaly: null });
});

test('business day range uses Africa/Kinshasa local midnight boundaries', () => {
  const range = businessDayRange('2026-10-16', 'Africa/Kinshasa');
  assert.equal(range.start.toISOString(), '2026-10-15T22:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-10-16T22:00:00.000Z');
});
