const test = require('node:test');
const assert = require('node:assert/strict');
const prismaPath = require.resolve('../src/config/prisma');
const accessPath = require.resolve('../src/services/departmentAccessService');
const originalPrisma = require.cache[prismaPath];
const originalAccess = require.cache[accessPath];

const agencies = new Map([
  ['agency-a', { id: 'agency-a', departmentId: 'coach-1', timeZone: 'Africa/Kinshasa', isActive: true }],
  ['agency-b', { id: 'agency-b', departmentId: 'coach-1', timeZone: 'America/New_York', isActive: true }],
]);
const db = { paymentRows: [], closures: new Map(), entries: [], events: [], corrections: [] };
const keyOf = (agencyId, day) => agencyId + ':' + new Date(day).toISOString().slice(0, 10);
const includeFor = (row) => ({ ...row, entries: db.entries.filter((entry) => entry.closureId === row.id), events: db.events.filter((event) => event.closureId === row.id), corrections: db.corrections.filter((item) => item.closureId === row.id) });

const prisma = {
  agency: { findFirst: async ({ where }) => {
    const agency = agencies.get(where.id);
    return agency && agency.isActive && (!where.departmentId || agency.departmentId === where.departmentId) && (!where.department || where.department.type === 'VANGUARD_COACH') ? agency : null;
  } },
  payment: { findMany: async ({ where }) => {
    const range = where.validatedAt;
    return db.paymentRows.filter((payment) => where.status.in.includes(payment.status))
      .filter((payment) => payment.channel === where.channel && payment.method === where.method)
      .filter((payment) => range === null ? !payment.validatedAt : payment.validatedAt && payment.validatedAt >= range.gte && payment.validatedAt < range.lt);
  } },
  cashClosure: {
    findUnique: async ({ where }) => {
      if (where.id) { const found = [...db.closures.values()].find((item) => item.id === where.id); return found ? includeFor(found) : null; }
      const found = db.closures.get(keyOf(where.agencyId_businessDate.agencyId, where.agencyId_businessDate.businessDate));
      return found ? includeFor(found) : null;
    },
    upsert: async ({ where, create, update }) => {
      const key = keyOf(where.agencyId_businessDate.agencyId, where.agencyId_businessDate.businessDate);
      const found = db.closures.get(key);
      if (found) Object.assign(found, update);
      else db.closures.set(key, { id: 'closure-' + (db.closures.size + 1), ...create, status: 'DRAFT', entries: [], events: [], corrections: [] });
      return db.closures.get(key);
    },
    updateMany: async ({ where, data }) => {
      const row = [...db.closures.values()].find((item) => item.id === where.id);
      if (!row || row.status !== where.status) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  },
  cashClosureEntry: {
    deleteMany: async ({ where }) => { db.entries = db.entries.filter((item) => item.closureId !== where.closureId); },
    createMany: async ({ data }) => {
      if (data.some((item) => db.entries.some((existing) => existing.paymentId === item.paymentId))) { const error = new Error('unique payment entry'); error.code = 'P2002'; throw error; }
      db.entries.push(...data.map((item, index) => ({ id: 'entry-' + index, ...item })));
      return { count: data.length };
    },
  },
  cashClosureEvent: { create: async ({ data }) => { const item = { id: 'event-' + (db.events.length + 1), ...data, createdAt: new Date() }; db.events.push(item); return item; } },
  cashClosureCorrection: {
    create: async ({ data }) => { const item = { id: 'correction-' + (db.corrections.length + 1), status: 'SUBMITTED', ...data }; db.corrections.push(item); return item; },
    updateMany: async ({ where, data }) => {
      const item = db.corrections.find((row) => row.id === where.id && row.closureId === where.closureId && row.status === where.status);
      if (!item) return { count: 0 };
      Object.assign(item, data);
      return { count: 1 };
    },
  },
  $transaction: async (work) => work(prisma),
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
require.cache[accessPath] = { id: accessPath, filename: accessPath, loaded: true, exports: { getUserAgencyId: (user) => user?.agencyId || user?.agency?.id || null } };
const service = require('../src/services/cashClosureService');

const managerA = { id: 'manager-a', role: 'MANAGER', departmentId: 'coach-1', department: { type: 'VANGUARD_COACH' }, agencyId: 'agency-a', permissions: ['APPROVE_DAILY_CASH_CLOSURE'] };
const managerB = { ...managerA, id: 'manager-b', agencyId: 'agency-b' };
const serviceAdmin = { id: 'admin', role: 'SERVICE_ADMIN', departmentId: 'coach-1', department: { type: 'VANGUARD_COACH' }, permissions: ['APPROVE_DAILY_CASH_CLOSURE'] };
const validAt = new Date('2026-10-12T12:00:00.000Z');
const reservationPayment = (id, amount, currency = 'USD', extra = {}) => ({
  id, reservationId: 'reservation-' + id, parcelId: null, amount, currency, method: 'CASH', channel: 'AGENCY', status: 'VERIFIED', agencyId: 'agency-a', validatedAt: validAt,
  reservation: { id: 'reservation-' + id, status: 'CONFIRMED', agencyId: 'agency-a', trip: { schedule: { agencyId: 'agency-a' } } }, parcel: null, ...extra,
});
const parcelPayment = (id, timing, collectedAgencyId, status = 'READY_FOR_PICKUP', extra = {}) => ({
  id, reservationId: null, parcelId: 'parcel-' + id, amount: '10.00', currency: 'USD', method: 'CASH', channel: 'AGENCY', status: 'VERIFIED', agencyId: 'agency-a', validatedAt: validAt,
  reservation: null, parcel: { id: 'parcel-' + id, paymentTiming: timing, originAgencyId: 'agency-a', destinationAgencyId: 'agency-b', status }, ...extra,
});

test.beforeEach(() => {
  db.paymentRows = [];
  db.closures.clear();
  db.entries = [];
  db.events = [];
  db.corrections = [];
});
test.after(() => {
  if (originalPrisma) require.cache[prismaPath] = originalPrisma; else delete require.cache[prismaPath];
  if (originalAccess) require.cache[accessPath] = originalAccess; else delete require.cache[accessPath];
});

test('derives the Manager agency and rejects a forged agencyId', async () => {
  await assert.rejects(() => service.saveDraft({ agencyId: 'agency-b', businessDate: '2026-10-12', declaredUsd: '0', declaredCdf: '0' }, managerA), /agencyId/);
});
test('sums reservation partial payments once by Payment id and keeps USD/CDF separate', async () => {
  db.paymentRows = [reservationPayment('p1', '12.50'), reservationPayment('p2', '7.50'), reservationPayment('p3', '100.00', 'CDF')];
  const result = await service.calculateDay(prisma, agencies.get('agency-a'), '2026-10-12');
  assert.equal(result.usdCents, 2000);
  assert.equal(result.cdfCents, 10000);
  assert.equal(result.entries.length, 3);
});
test('attributes deposit parcels to the origin agency', () => {
  assert.deepEqual(service.classifyPayment(parcelPayment('deposit', 'AT_DEPOSIT', 'agency-a'), 'agency-a'), { source: 'PARCEL' });
  assert.deepEqual(service.classifyPayment(parcelPayment('deposit', 'AT_DEPOSIT', 'agency-a'), 'agency-b'), { excluded: true });
});
test('attributes pickup parcels to the destination agency, independent of legacy payment agencyId', () => {
  const payment = parcelPayment('pickup', 'AT_PICKUP', 'agency-b');
  payment.agencyId = 'agency-a';
  assert.deepEqual(service.classifyPayment(payment, 'agency-b'), { source: 'PARCEL' });
  assert.deepEqual(service.classifyPayment(payment, 'agency-a'), { excluded: true });
});
test('retains collected payments after later reservation cancellation or parcel return and reports ambiguous relations', () => {
  assert.deepEqual(service.classifyPayment(reservationPayment('cancelled', '5', 'USD', { reservation: { status: 'CANCELLED', agencyId: 'agency-a' } }), 'agency-a'), { source: 'RESERVATION' });
  assert.deepEqual(service.classifyPayment(parcelPayment('returned', 'AT_PICKUP', 'agency-b', 'RETURNED'), 'agency-b'), { source: 'PARCEL' });
  assert.equal(service.classifyPayment({ ...reservationPayment('both', '1'), parcelId: 'parcel-both', parcel: { paymentTiming: 'AT_DEPOSIT' } }, 'agency-a').issue, 'ambiguous_payment_relation');
});
test('counts validated gross receipts despite later cancellation, return, or refund status; flags unrecorded refund movement', async () => {
  db.paymentRows = [
    reservationPayment('paid-then-cancelled', '12.50', 'USD', { reservation: { id: 'r-cancelled', status: 'CANCELLED', agencyId: 'agency-a', trip: { schedule: { agencyId: 'agency-a' } } } }),
    parcelPayment('paid-then-returned', 'AT_DEPOSIT', 'agency-a', 'RETURNED'),
    reservationPayment('pending-cancelled', '40.00', 'USD', { status: 'PENDING', validatedAt: null, reservation: { id: 'r-pending', status: 'CANCELLED', agencyId: 'agency-a', trip: { schedule: { agencyId: 'agency-a' } } } }),
    reservationPayment('refunded', '99.00', 'USD', { status: 'REFUNDED' }),
  ];
  const result = await service.calculateDay(prisma, agencies.get('agency-a'), '2026-10-12');
  assert.equal(result.usdCents, 12150);
  assert.deepEqual(result.entries.map((entry) => entry.paymentId).sort(), ['paid-then-cancelled', 'paid-then-returned', 'refunded']);
  assert.deepEqual(result.anomalies, [{ paymentId: 'refunded', reason: 'refund_cash_movement_not_recorded' }]);
});
test('reports missing validation dates and unsupported currencies without substituting createdAt', async () => {
  db.paymentRows = [
    { ...reservationPayment('undated', '5'), validatedAt: null, createdAt: validAt },
    { ...reservationPayment('refunded-undated', '8', 'USD', { status: 'REFUNDED' }), validatedAt: null, createdAt: validAt },
    reservationPayment('unsupported', '4', 'EUR'),
    reservationPayment('valid', '3'),
  ];
  const result = await service.calculateDay(prisma, agencies.get('agency-a'), '2026-10-12');
  assert.equal(result.usdCents, 300);
  assert.deepEqual(result.anomalies.map((item) => item.reason).sort(), ['missing_validated_at', 'missing_validated_at', 'unsupported_currency']);
});
test('uses DST-aware agency-local day bounds (23 and 25 hours)', () => {
  const { businessDayRange, isValidTimeZone } = require('../src/utils/businessTime');
  const spring = businessDayRange('2026-03-08', 'America/New_York');
  const autumn = businessDayRange('2026-11-01', 'America/New_York');
  assert.equal((spring.end - spring.start) / 3600000, 23);
  assert.equal((autumn.end - autumn.start) / 3600000, 25);
  assert.equal(isValidTimeZone('Invalid/Zone'), false);
});
test('creates one closure per agency and day and persists the declaration', async () => {
  await service.saveDraft({ businessDate: '2026-10-12', declaredUsd: '2.00', declaredCdf: '0' }, managerA);
  await service.saveDraft({ businessDate: '2026-10-12', declaredUsd: '3.00', declaredCdf: '0' }, managerA);
  assert.equal(db.closures.size, 1);
});
test('requires a variance justification before submission', async () => {
  const saved = await service.saveDraft({ businessDate: '2026-10-12', declaredUsd: '2', declaredCdf: '0' }, managerA);
  await assert.rejects(() => service.submit(saved.closure.id, managerA), /justification/);
});
test('submits, approves from a different active agency, and freezes an approved closure', async () => {
  db.paymentRows = [reservationPayment('p1', '10')];
  const saved = await service.saveDraft({ businessDate: '2026-10-12', declaredUsd: '10', declaredCdf: '0' }, managerA);
  const submitted = await service.submit(saved.closure.id, managerA);
  assert.equal(submitted.closure.status, 'SUBMITTED');
  db.paymentRows[0].amount = '99.00';
  db.paymentRows[0].reservation.status = 'CANCELLED';
  const historical = await service.getForAgencyDay('2026-10-12', managerA);
  assert.equal(historical.closure.theoreticalUsd, '10.00');
  assert.equal(historical.closure.entries[0].amount, '10.00');
  assert.equal(historical.preview.theoreticalUsd, '10.00');
  const approved = await service.review(saved.closure.id, 'APPROVED', null, managerB);
  assert.equal(approved.closure.status, 'APPROVED');
  const approvedSnapshot = await service.getForAgencyDay('2026-10-12', managerA);
  assert.equal(approvedSnapshot.closure.theoreticalUsd, '10.00');
  assert.equal(approvedSnapshot.preview.theoreticalUsd, '10.00');
  await assert.rejects(() => service.saveDraft({ businessDate: '2026-10-12', declaredUsd: '10', declaredCdf: '0' }, managerA), /immutable/);
});
test('requires a rejection reason and refuses same-agency or unprivileged approval', async () => {
  const saved = await service.saveDraft({ businessDate: '2026-10-12', declaredUsd: '0', declaredCdf: '0' }, managerA);
  await service.submit(saved.closure.id, managerA);
  await assert.rejects(() => service.review(saved.closure.id, 'REJECTED', '', managerB), /reason/);
  await assert.rejects(() => service.review(saved.closure.id, 'APPROVED', null, managerA), /own agency/);
  await assert.rejects(() => service.review(saved.closure.id, 'APPROVED', null, { ...managerB, permissions: [] }), /permissions/);
  const rejected = await service.review(saved.closure.id, 'REJECTED', 'Comptage à vérifier', managerB);
  assert.equal(rejected.closure.status, 'REJECTED');
  assert.equal(rejected.closure.rejectionReason, 'Comptage à vérifier');
});
test('allows a Service Admin only inside the Coach department and requires explicit approval permission', async () => {
  const saved = await service.saveDraft({ businessDate: '2026-10-12', declaredUsd: '0', declaredCdf: '0' }, managerA);
  await service.submit(saved.closure.id, managerA);
  await assert.rejects(() => service.review(saved.closure.id, 'APPROVED', null, { ...serviceAdmin, departmentId: 'other' }), /outside the closure department/);
  const result = await service.review(saved.closure.id, 'APPROVED', null, serviceAdmin);
  assert.equal(result.closure.status, 'APPROVED');
});
test('corrections require reasons, remain append-only, and change only the closure reconciliation', async () => {
  db.paymentRows = [reservationPayment('p-correction', '10')];
  const saved = await service.saveDraft({ businessDate: '2026-10-12', declaredUsd: '10', declaredCdf: '0', justification: 'Rapprochement vérifié' }, managerA);
  await service.submit(saved.closure.id, managerA);
  await service.review(saved.closure.id, 'APPROVED', null, managerB);
  await assert.rejects(() => service.createCorrection(saved.closure.id, { amountUsd: '1', amountCdf: '0', reason: '' }, managerA), /non-zero correction and reason/);
  const corrected = await service.createCorrection(saved.closure.id, { amountUsd: '-1.00', amountCdf: '0', reason: 'Correction justifiée' }, managerA);
  assert.equal(corrected.closure.status, 'APPROVED');
  const reviewed = await service.reviewCorrection(saved.closure.id, corrected.closure.corrections[0].id, 'APPROVED', null, managerB);
  assert.equal(reviewed.closure.varianceUsd, '-1.00');
});
test('prevents the same Payment from being allocated to a second closure', async () => {
  db.paymentRows = [reservationPayment('p1', '10')];
  const first = await service.saveDraft({ businessDate: '2026-10-12', declaredUsd: '10', declaredCdf: '0' }, managerA);
  await service.submit(first.closure.id, managerA);
  const repeatedId = { ...reservationPayment('p1', '10'), validatedAt: new Date('2026-10-13T12:00:00.000Z') };
  db.paymentRows = [repeatedId];
  const second = await service.saveDraft({ businessDate: '2026-10-13', declaredUsd: '10', declaredCdf: '0' }, managerA);
  await assert.rejects(() => service.submit(second.closure.id, managerA), /another closure|concurrently/);
});
