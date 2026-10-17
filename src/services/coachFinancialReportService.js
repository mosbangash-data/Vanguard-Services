const { AppError } = require('../middleware/errorHandler');
const { parseDateKey, businessMidnightUtc } = require('../utils/businessTime');

// Both Coach cash workflows explicitly create/transition payments to VERIFIED.
// COMPLETED is a recognized enum but is not a collection transition in these workflows.
const PAID = { TRANSPORT: ['VERIFIED'], PARCEL: ['VERIFIED'] };
const CURRENCIES = ['USD', 'CDF'];
const add = (target, currency, amount) => { if (CURRENCIES.includes(currency)) target[currency] += Math.round(Number(amount) * 100); };
const money = (totals) => Object.fromEntries(CURRENCIES.map((currency) => [currency, (totals[currency] / 100).toFixed(2)]));
const classifyPayment = (payment) => {
  const reservation = Boolean(payment.reservationId);
  const parcel = Boolean(payment.parcelId);
  if (reservation === parcel) return { activity: null, anomaly: reservation ? 'AMBIGUOUS_RELATION' : 'UNATTACHED_PAYMENT' };
  return { activity: parcel ? 'PARCEL' : 'TRANSPORT', anomaly: null };
};
const aggregatePayments = (payments, status = 'ALL', activity = 'ALL', currency = 'ALL') => {
  const totals = { TRANSPORT: { USD: 0, CDF: 0 }, PARCEL: { USD: 0, CDF: 0 }, pending: { USD: 0, CDF: 0 } };
  const anomalies = { ambiguousPayments: 0, unattachedPayments: 0, unsupportedCurrencyPayments: 0, refundCount: 0 };
  const included = new Set();
  let validatedPaymentCount = 0; let pendingPaymentCount = 0;
  for (const payment of payments) {
    const classification = classifyPayment(payment);
    if (classification.anomaly) { anomalies[classification.anomaly === 'AMBIGUOUS_RELATION' ? 'ambiguousPayments' : 'unattachedPayments']++; continue; }
    if (activity !== 'ALL' && activity !== classification.activity) continue;
    if (currency !== 'ALL' && currency !== payment.currency) continue;
    if (payment.status === 'REFUNDED') { anomalies.refundCount++; continue; }
    if (payment.status === 'PENDING' && ['ALL', 'PENDING'].includes(status)) {
      add(totals.pending, payment.currency, payment.amount); pendingPaymentCount++; continue;
    }
    if (status === 'PENDING' || !PAID[classification.activity].includes(payment.status) || !payment.validatedAt) continue;
    if (included.has(payment.id)) continue;
    included.add(payment.id); add(totals[classification.activity], payment.currency, payment.amount); validatedPaymentCount++;
    if (!CURRENCIES.includes(payment.currency)) anomalies.unsupportedCurrencyPayments++;
  }
  return { totals, total: { USD: totals.TRANSPORT.USD + totals.PARCEL.USD, CDF: totals.TRANSPORT.CDF + totals.PARCEL.CDF }, anomalies, validatedPaymentCount, pendingPaymentCount };
};

function validateFilters(query) {
  const { startDate, endDate, currency = 'ALL', status = 'ALL', activity = 'ALL' } = query;
  if (!parseDateKey(startDate) || !parseDateKey(endDate) || startDate > endDate) throw new AppError('Invalid report date range', 400);
  const days = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 + 1;
  if (days > 366) throw new AppError('Report date range exceeds 366 days', 400);
  if (!['ALL', ...CURRENCIES].includes(currency)) throw new AppError('Invalid report currency', 400);
  if (!['ALL', 'PENDING', 'VERIFIED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'FAILED', 'PROCESSING'].includes(status)) throw new AppError('Invalid report status', 400);
  if (!['ALL', 'TRANSPORT', 'PARCEL'].includes(activity)) throw new AppError('Invalid report activity', 400);
  return { startDate, endDate, currency, status, activity };
}

async function getCoachFinancialReport(query, user) {
  if (!user) throw new AppError('Unauthorized', 401);
  if (!user.permissions?.includes('VIEW_PAYMENT')) throw new AppError('Insufficient permissions', 403);
  if (!['SUPER_ADMIN', 'SERVICE_ADMIN', 'MANAGER', 'AGENT'].includes(user.role)) throw new AppError('Access denied', 403);
  if (user.role !== 'SUPER_ADMIN' && user.department?.type !== 'VANGUARD_COACH') throw new AppError('Access denied', 403);
  const filters = validateFilters(query);
  const prisma = require('../config/prisma');
  const { getUserAgencyId, assertDepartmentIdForUser } = require('./departmentAccessService');
  const department = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' }, select: { id: true } });
  if (!department) throw new AppError('Vanguard Coach department not found', 404);
  await assertDepartmentIdForUser(user, department.id, 'VANGUARD_COACH');
  let agencyId = null;
  let timeZone = 'Africa/Kinshasa';
  if (['MANAGER', 'AGENT'].includes(user.role)) {
    agencyId = getUserAgencyId(user);
    if (!agencyId) throw new AppError('Agency assignment required', 403);
    const agency = await prisma.agency.findFirst({ where: { id: agencyId, departmentId: department.id, isActive: true }, select: { id: true, timeZone: true } });
    if (!agency) throw new AppError('Agency assignment is invalid', 403);
    timeZone = agency.timeZone || timeZone;
  }
  const start = businessMidnightUtc(filters.startDate, timeZone);
  const dayAfter = new Date(Date.parse(`${filters.endDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const end = businessMidnightUtc(dayAfter, timeZone);
  if (!start || !end) throw new AppError('Invalid business date range', 400);
  const relationScopes = [];
  if (filters.activity !== 'PARCEL') relationScopes.push({ reservation: { trip: { schedule: { departmentId: department.id, ...(agencyId ? { agencyId } : {}) } } }, parcelId: null });
  if (filters.activity !== 'TRANSPORT') relationScopes.push({ parcel: { ...(agencyId ? { OR: [{ originAgencyId: agencyId }, { destinationAgencyId: agencyId }] } : { OR: [{ originAgency: { departmentId: department.id } }, { destinationAgency: { departmentId: department.id } }] }) }, reservationId: null });
  const commonWhere = { channel: 'AGENCY', method: 'CASH', OR: relationScopes };
  if (filters.currency !== 'ALL') commonWhere.currency = filters.currency;
  const payments = await prisma.payment.findMany({ where: commonWhere, select: { id: true, reservationId: true, parcelId: true, amount: true, currency: true, method: true, status: true, createdAt: true, validatedAt: true, agencyId: true } });
  const reportPayments = payments.filter((payment) => payment.status === 'PENDING'
    ? payment.createdAt >= start && payment.createdAt < end
    : payment.status === 'REFUNDED'
      ? payment.validatedAt && payment.validatedAt >= start && payment.validatedAt < end
      : payment.validatedAt && payment.validatedAt >= start && payment.validatedAt < end);
  const aggregated = aggregatePayments(reportPayments, filters.status, filters.activity, filters.currency);
  const totals = aggregated.totals;
  const ticketWhere = { issuedAt: { gte: start, lt: end }, status: { not: 'CANCELLED' }, reservation: { trip: { schedule: { departmentId: department.id, ...(agencyId ? { agencyId } : {}) } } } };
  const tickets = filters.activity === 'PARCEL' ? 0 : await prisma.ticket.count({ where: ticketWhere });
  return { filters: { ...filters, agencyId, timeZone, start: start.toISOString(), endExclusive: end.toISOString() }, totals: { transportCollected: money(totals.TRANSPORT), parcelCollected: money(totals.PARCEL), totalCollected: money(aggregated.total), pendingAmount: money(totals.pending), validatedPaymentCount: aggregated.validatedPaymentCount, pendingPaymentCount: aggregated.pendingPaymentCount, issuedTicketCount: tickets }, anomalies: { ...aggregated.anomalies, refundReconciliation: 'Refunds have no dedicated effective timestamp or cash movement record; refundCount is not a period-of-refund measure and net revenue cannot be calculated.' } };
}
module.exports = { getCoachFinancialReport, validateFilters, PAID, classifyPayment, aggregatePayments };
