const { dateKeyAt, addDateKeyDays } = require('./businessTime');

const CONFIRMED_PAYMENT_STATUSES = new Set(['VERIFIED', 'COMPLETED']);

const aggregateAgentRevenue = ({ ticketPayments = [], parcelPayments = [], agentId, businessDate }) => {
  const historyStartDate = addDateKeyDays(businessDate, -6);
  const revenueHistory = Array.from({ length: 7 }, (_, index) => ({
    date: addDateKeyDays(historyStartDate, index),
    currencies: {},
  }));
  const seenPaymentIds = new Set();

  const addPayments = (payments, { requireCash = false } = {}) => {
    for (const payment of payments) {
      if (!payment?.id || seenPaymentIds.has(payment.id)) continue;
      if (!CONFIRMED_PAYMENT_STATUSES.has(payment.status) || payment.validatedById !== agentId || !payment.validatedAt) continue;
      if (requireCash && payment.method !== 'CASH') continue;

      const day = revenueHistory.find((item) => item.date === dateKeyAt(new Date(payment.validatedAt)));
      if (!day) continue;

      seenPaymentIds.add(payment.id);
      const currency = payment.currency || 'USD';
      day.currencies[currency] = (day.currencies[currency] || 0) + Number(payment.amount || 0);
    }
  };

  addPayments(ticketPayments);
  addPayments(parcelPayments, { requireCash: true });

  const today = revenueHistory.find((item) => item.date === businessDate);
  return {
    revenueByCurrency: today?.currencies || {},
    revenueHistory,
  };
};

module.exports = { aggregateAgentRevenue, CONFIRMED_PAYMENT_STATUSES };
