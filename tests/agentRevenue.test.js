const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregateAgentRevenue } = require('../src/utils/agentRevenue');

const agentId = 'agent-1';
const businessDate = '2026-06-15';
const payment = (overrides = {}) => ({
  id: 'payment-1',
  amount: '10.00',
  currency: 'USD',
  status: 'VERIFIED',
  validatedById: agentId,
  validatedAt: new Date('2026-06-15T12:00:00.000Z'),
  method: 'CASH',
  ...overrides,
});

test('daily and seven-day revenue combine confirmed ticket and cash parcel payments', () => {
  const result = aggregateAgentRevenue({
    agentId,
    businessDate,
    ticketPayments: [payment({ id: 'ticket-1', amount: '20.00', method: 'MOBILE_MONEY' })],
    parcelPayments: [payment({ id: 'parcel-1', amount: '15.50' })],
  });

  assert.deepEqual(result.revenueByCurrency, { USD: 35.5 });
  assert.deepEqual(result.revenueHistory.find((day) => day.date === businessDate).currencies, { USD: 35.5 });
});

test('pending, failed, cancelled, unvalidated and non-cash parcel payments are excluded', () => {
  const result = aggregateAgentRevenue({
    agentId,
    businessDate,
    ticketPayments: [
      payment({ id: 'pending-ticket', status: 'PENDING', amount: '100.00' }),
      payment({ id: 'failed-ticket', status: 'FAILED', amount: '100.00' }),
      payment({ id: 'cancelled-ticket', status: 'CANCELLED', amount: '100.00' }),
      payment({ id: 'unvalidated-ticket', validatedAt: null, amount: '100.00' }),
    ],
    parcelPayments: [
      payment({ id: 'pending-parcel', status: 'PENDING', amount: '100.00' }),
      payment({ id: 'non-cash-parcel', method: 'MOBILE_MONEY', amount: '100.00' }),
      payment({ id: 'other-agent-parcel', validatedById: 'agent-2', amount: '100.00' }),
    ],
  });

  assert.deepEqual(result.revenueByCurrency, {});
  assert.ok(result.revenueHistory.every((day) => Object.keys(day.currencies).length === 0));
});

test('a payment ID present in both sources is counted once', () => {
  const sharedPayment = payment({ id: 'shared-payment', amount: '12.25' });
  const result = aggregateAgentRevenue({
    agentId,
    businessDate,
    ticketPayments: [sharedPayment],
    parcelPayments: [sharedPayment],
  });

  assert.deepEqual(result.revenueByCurrency, { USD: 12.25 });
});

test('revenue history uses validation date and excludes payments outside the selected seven-day period', () => {
  const result = aggregateAgentRevenue({
    agentId,
    businessDate,
    ticketPayments: [
      payment({ id: 'today', amount: '5.00' }),
      payment({ id: 'older-day', amount: '7.00', validatedAt: new Date('2026-06-10T12:00:00.000Z') }),
      payment({ id: 'outside-range', amount: '90.00', validatedAt: new Date('2026-06-08T12:00:00.000Z') }),
    ],
    parcelPayments: [],
  });

  assert.deepEqual(result.revenueByCurrency, { USD: 5 });
  assert.deepEqual(result.revenueHistory.find((day) => day.date === '2026-06-10').currencies, { USD: 7 });
  assert.equal(result.revenueHistory.some((day) => day.date === '2026-06-08'), false);
});
