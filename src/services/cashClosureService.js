const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { getUserAgencyId } = require('./departmentAccessService');
const { businessDayRange, dateKeyAt, isValidTimeZone, parseDateKey } = require('../utils/businessTime');

const PAID_STATUSES = ['VERIFIED', 'COMPLETED', 'REFUNDED'];
const CLOSE_PERMISSION = 'APPROVE_DAILY_CASH_CLOSURE';
const toCents = (value, { allowNegative = false } = {}) => {
  const raw = typeof value === 'number' ? String(value) : String(value ?? '').trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw) || (!allowNegative && raw.startsWith('-'))) throw new AppError('Amounts must be valid values with up to two decimals', 400);
  const cents = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(cents)) throw new AppError('Amount is outside the supported range', 400);
  return cents;
};
const money = (cents) => (cents / 100).toFixed(2);
const dateValue = (date) => new Date(date + 'T00:00:00.000Z');
const dateText = (date) => new Date(date).toISOString().slice(0, 10);
const closureKey = (agencyId, businessDate) => ({ agencyId_businessDate: { agencyId, businessDate: dateValue(businessDate) } });

const requireCoach = (user) => {
  if (!user || user.department?.type !== 'VANGUARD_COACH') throw new AppError('Access denied', 403);
};
const getActiveAgency = async (user) => {
  requireCoach(user);
  if (user.role !== 'MANAGER') throw new AppError('Only Managers can prepare an agency cash closure', 403);
  const agencyId = getUserAgencyId(user);
  if (!agencyId) throw new AppError('Manager agency assignment is required', 403);
  const agency = await prisma.agency.findFirst({ where: { id: agencyId, departmentId: user.departmentId || user.department?.id, department: { type: 'VANGUARD_COACH' }, isActive: true } });
  if (!agency) throw new AppError('Manager agency is invalid, inactive, or outside Vanguard Coach', 403);
  return agency;
};
const assertReviewer = async (user, closure) => {
  if (!user?.permissions?.includes(CLOSE_PERMISSION)) throw new AppError('Insufficient permissions', 403);
  const agency = await prisma.agency.findFirst({ where: { id: closure.agencyId, isActive: true, department: { type: 'VANGUARD_COACH' } } });
  if (!agency) throw new AppError('Closure agency is no longer active in Vanguard Coach', 403);
  if (user.role === 'MANAGER') {
    requireCoach(user);
    const reviewerAgencyId = getUserAgencyId(user);
    if (!reviewerAgencyId) throw new AppError('Manager agency assignment is required', 403);
    const reviewerAgency = await prisma.agency.findFirst({ where: { id: reviewerAgencyId, isActive: true, departmentId: agency.departmentId } });
    if (!reviewerAgency) throw new AppError('Reviewer agency is invalid or inactive', 403);
    if (reviewerAgency.id === closure.agencyId) throw new AppError('A Manager cannot approve or reject their own agency closure', 403);
    return;
  }
  if (user.role === 'SERVICE_ADMIN') {
    requireCoach(user);
    if ((user.departmentId || user.department?.id) !== agency.departmentId) throw new AppError('Service Admin is outside the closure department', 403);
    return;
  }
  if (user.role !== 'SUPER_ADMIN') throw new AppError('Access denied', 403);
};

const relationScope = (agencyId) => ({ OR: [
  { reservation: { is: { OR: [
    { agencyId },
    { AND: [{ agencyId: null }, { trip: { schedule: { agencyId } } }] },
  ] } } },
  { parcel: { is: { OR: [{ originAgencyId: agencyId }, { destinationAgencyId: agencyId }] } } },
] });

const classifyPayment = (payment, agencyId) => {
  const hasReservation = Boolean(payment.reservationId && payment.reservation);
  const hasParcel = Boolean(payment.parcelId && payment.parcel);
  if (hasReservation === hasParcel) return { issue: 'ambiguous_payment_relation' };
  if (hasReservation) {
    const reservation = payment.reservation;
    const reservationAgencyId = reservation.agencyId || reservation.trip?.schedule?.agencyId || null;
    if (!reservationAgencyId) return { issue: 'reservation_agency_missing' };
    if (payment.agencyId && payment.agencyId !== reservationAgencyId) return { issue: 'reservation_payment_agency_mismatch' };
    if (reservationAgencyId !== agencyId) return { excluded: true };
    return { source: 'RESERVATION' };
  }
  const parcel = payment.parcel;
  const collectedAgencyId = parcel.paymentTiming === 'AT_PICKUP' ? parcel.destinationAgencyId : parcel.originAgencyId;
  if (!collectedAgencyId) return { issue: 'parcel_collection_agency_missing' };
  if (collectedAgencyId !== agencyId) return { excluded: true };
  return { source: 'PARCEL' };
};

const calculateDay = async (db, agency, businessDate) => {
  if (!parseDateKey(businessDate)) throw new AppError('businessDate must be a valid YYYY-MM-DD date', 400);
  if (!isValidTimeZone(agency.timeZone)) throw new AppError('Agency time zone is invalid; contact an administrator', 409);
  const range = businessDayRange(businessDate, agency.timeZone);
  if (!range) throw new AppError('No valid business-day boundary exists for this date and time zone', 400);
  const scope = relationScope(agency.id);
  const baseWhere = { ...scope, channel: 'AGENCY', method: 'CASH', status: { in: PAID_STATUSES } };
  const [payments, undated] = await Promise.all([
    db.payment.findMany({ where: { ...baseWhere, validatedAt: { gte: range.start, lt: range.end } }, include: { reservation: { include: { trip: { include: { schedule: true } } } }, parcel: true } }),
    db.payment.findMany({ where: { ...baseWhere, validatedAt: null }, include: { reservation: { include: { trip: { include: { schedule: true } } } }, parcel: true } }),
  ]);
  const entries = [];
  const anomalies = [];
  for (const payment of undated) {
    const classification = classifyPayment(payment, agency.id);
    if (classification.excluded) continue;
    anomalies.push({ paymentId: payment.id, reason: classification.issue || 'missing_validated_at' });
  }
  let usdCents = 0;
  let cdfCents = 0;
  for (const payment of payments) {
    const classification = classifyPayment(payment, agency.id);
    if (classification.excluded) continue;
    if (classification.issue) { anomalies.push({ paymentId: payment.id, reason: classification.issue }); continue; }
    if (payment.status === 'REFUNDED') anomalies.push({ paymentId: payment.id, reason: 'refund_cash_movement_not_recorded' });
    if (!['USD', 'CDF'].includes(payment.currency)) { anomalies.push({ paymentId: payment.id, reason: 'unsupported_currency' }); continue; }
    const cents = toCents(payment.amount);
    if (payment.currency === 'USD') usdCents += cents;
    else cdfCents += cents;
    entries.push({ paymentId: payment.id, source: classification.source, amount: money(cents), currency: payment.currency, collectedAt: payment.validatedAt });
  }
  return { range, usdCents, cdfCents, entries, anomalies };
};

const sumCorrections = (corrections = []) => corrections.filter((item) => item.status === 'APPROVED').reduce((sum, item) => {
  sum.usdCents += toCents(item.amountUsd, { allowNegative: true });
  sum.cdfCents += toCents(item.amountCdf, { allowNegative: true });
  return sum;
}, { usdCents: 0, cdfCents: 0 });

const toDto = (closure, preview = null) => {
  if (!closure) return { closure: null, preview };
  const corrections = sumCorrections(closure.corrections);
  const declaredUsd = closure.declaredUsd === null ? null : toCents(closure.declaredUsd, { allowNegative: true });
  const declaredCdf = closure.declaredCdf === null ? null : toCents(closure.declaredCdf, { allowNegative: true });
  return {
    closure: {
      id: closure.id, agencyId: closure.agencyId, businessDate: dateText(closure.businessDate), timeZone: closure.timeZone,
      status: closure.status, theoreticalUsd: String(closure.theoreticalUsd), theoreticalCdf: String(closure.theoreticalCdf),
      declaredUsd: closure.declaredUsd === null ? null : String(closure.declaredUsd),
      declaredCdf: closure.declaredCdf === null ? null : String(closure.declaredCdf),
      varianceUsd: declaredUsd === null ? null : money(declaredUsd + corrections.usdCents - toCents(closure.theoreticalUsd)),
      varianceCdf: declaredCdf === null ? null : money(declaredCdf + corrections.cdfCents - toCents(closure.theoreticalCdf)),
      approvedCorrections: { usd: money(corrections.usdCents), cdf: money(corrections.cdfCents) },
      justification: closure.justification, createdById: closure.createdById, submittedAt: closure.submittedAt,
      submittedById: closure.submittedById, approvedAt: closure.approvedAt, approvedById: closure.approvedById,
      rejectedAt: closure.rejectedAt, rejectedById: closure.rejectedById, rejectionReason: closure.rejectionReason,
      entries: (closure.entries || []).map((entry) => ({ paymentId: entry.paymentId, source: entry.source, amount: String(entry.amount), currency: entry.currency, collectedAt: entry.collectedAt })),
      events: closure.events || [], corrections: closure.corrections || [],
    },
    preview: preview ? { businessDate: preview.businessDate, timeZone: preview.timeZone, theoreticalUsd: money(preview.usdCents), theoreticalCdf: money(preview.cdfCents), eligiblePaymentCount: preview.entries.length, anomalies: preview.anomalies } : null,
  };
};

const loadClosure = (db, id) => db.cashClosure.findUnique({ where: { id }, include: { entries: { orderBy: { collectedAt: 'asc' } }, events: { orderBy: { createdAt: 'asc' } }, corrections: { orderBy: { createdAt: 'asc' } } } });
const saveEvent = (db, closureId, action, user, details) => db.cashClosureEvent.create({ data: { closureId, action, actorId: user.id, details } });

const getForAgencyDay = async (businessDate, user) => {
  const agency = await getActiveAgency(user);
  const operationalDate = businessDate || dateKeyAt(new Date(), agency.timeZone);
  const closure = await prisma.cashClosure.findUnique({ where: closureKey(agency.id, operationalDate), include: { entries: true, events: { orderBy: { createdAt: 'asc' } }, corrections: { orderBy: { createdAt: 'asc' } } } });
  if (closure && ['SUBMITTED', 'APPROVED'].includes(closure.status)) {
    const submittedEvent = [...(closure.events || [])].reverse().find((event) => event.action === 'SUBMITTED');
    const preview = {
      businessDate: operationalDate,
      timeZone: closure.timeZone,
      usdCents: toCents(closure.theoreticalUsd),
      cdfCents: toCents(closure.theoreticalCdf),
      entries: closure.entries || [],
      anomalies: submittedEvent?.details?.anomalies || [],
    };
    return toDto(closure, preview);
  }
  const calculated = await calculateDay(prisma, agency, operationalDate);
  return toDto(closure, { ...calculated, businessDate: operationalDate, timeZone: agency.timeZone });
};

const saveDraft = async (data, user) => {
  const agency = await getActiveAgency(user);
  if (data?.agencyId && data.agencyId !== agency.id) throw new AppError('agencyId must match the authenticated Manager agency', 403);
  const businessDate = data?.businessDate;
  const calculated = await calculateDay(prisma, agency, businessDate);
  const declaredUsdCents = toCents(data?.declaredUsd);
  const declaredCdfCents = toCents(data?.declaredCdf);
  const justification = typeof data?.justification === 'string' ? data.justification.trim() : '';
  const key = closureKey(agency.id, businessDate);
  return prisma.$transaction(async (tx) => {
    const current = await tx.cashClosure.findUnique({ where: key });
    if (current && !['DRAFT', 'REJECTED'].includes(current.status)) throw new AppError('Submitted or approved closures are immutable', 409);
    const closure = await tx.cashClosure.upsert({
      where: key,
      create: { agencyId: agency.id, businessDate: dateValue(businessDate), timeZone: agency.timeZone, theoreticalUsd: money(calculated.usdCents), theoreticalCdf: money(calculated.cdfCents), declaredUsd: money(declaredUsdCents), declaredCdf: money(declaredCdfCents), justification: justification || null, createdById: user.id },
      update: { timeZone: agency.timeZone, theoreticalUsd: money(calculated.usdCents), theoreticalCdf: money(calculated.cdfCents), declaredUsd: money(declaredUsdCents), declaredCdf: money(declaredCdfCents), justification: justification || null, status: 'DRAFT', rejectedAt: null, rejectedById: null, rejectionReason: null },
    });
    await saveEvent(tx, closure.id, 'DRAFT_SAVED', user, { theoreticalUsd: money(calculated.usdCents), theoreticalCdf: money(calculated.cdfCents), declaredUsd: money(declaredUsdCents), declaredCdf: money(declaredCdfCents), anomalyCount: calculated.anomalies.length });
    return toDto(await loadClosure(tx, closure.id), { ...calculated, businessDate, timeZone: agency.timeZone });
  }, { isolationLevel: 'Serializable' });
};

const submit = async (id, user) => {
  const agency = await getActiveAgency(user);
  try {
    return await prisma.$transaction(async (tx) => {
      const closure = await tx.cashClosure.findUnique({ where: { id } });
      if (!closure || closure.agencyId !== agency.id) throw new AppError('Cash closure not found', 404);
      if (!['DRAFT', 'REJECTED'].includes(closure.status)) throw new AppError('Only a draft or rejected closure can be submitted', 409);
      if (closure.declaredUsd === null || closure.declaredCdf === null) throw new AppError('Declared USD and CDF amounts are required', 400);
      const calculated = await calculateDay(tx, agency, dateText(closure.businessDate));
      const varianceUsd = toCents(closure.declaredUsd, { allowNegative: true }) - calculated.usdCents;
      const varianceCdf = toCents(closure.declaredCdf, { allowNegative: true }) - calculated.cdfCents;
      if ((varianceUsd !== 0 || varianceCdf !== 0) && !String(closure.justification || '').trim()) throw new AppError('A justification is required when a variance exists', 400);
      await tx.cashClosureEntry.deleteMany({ where: { closureId: id } });
      if (calculated.entries.length) await tx.cashClosureEntry.createMany({ data: calculated.entries.map((entry) => ({ closureId: id, ...entry })) });
      const changed = await tx.cashClosure.updateMany({ where: { id, status: closure.status }, data: { status: 'SUBMITTED', theoreticalUsd: money(calculated.usdCents), theoreticalCdf: money(calculated.cdfCents), timeZone: agency.timeZone, submittedAt: new Date(), submittedById: user.id } });
      if (changed.count !== 1) throw new AppError('Closure changed concurrently; reload and retry', 409);
      await saveEvent(tx, id, 'SUBMITTED', user, { theoreticalUsd: money(calculated.usdCents), theoreticalCdf: money(calculated.cdfCents), varianceUsd: money(varianceUsd), varianceCdf: money(varianceCdf), entries: calculated.entries, anomalies: calculated.anomalies });
      return toDto(await loadClosure(tx, id));
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error?.code === 'P2002' || error?.code === 'P2034') throw new AppError('A payment is already assigned to another closure or the closure changed concurrently; refresh and review.', 409);
    throw error;
  }
};

const review = async (id, action, reason, user) => {
  const closure = await loadClosure(prisma, id);
  if (!closure) throw new AppError('Cash closure not found', 404);
  await assertReviewer(user, closure);
  if (closure.status !== 'SUBMITTED') throw new AppError('Only submitted closures can be reviewed', 409);
  if (action === 'REJECTED' && !String(reason || '').trim()) throw new AppError('A rejection reason is required', 400);
  return prisma.$transaction(async (tx) => {
    const changed = await tx.cashClosure.updateMany({
      where: { id, status: 'SUBMITTED' },
      data: action === 'APPROVED'
        ? { status: 'APPROVED', approvedAt: new Date(), approvedById: user.id }
        : { status: 'REJECTED', rejectedAt: new Date(), rejectedById: user.id, rejectionReason: String(reason).trim() },
    });
    if (changed.count !== 1) throw new AppError('Closure changed concurrently; reload and retry', 409);
    await saveEvent(tx, id, action, user, action === 'REJECTED' ? { reason: String(reason).trim() } : {});
    return toDto(await loadClosure(tx, id));
  }, { isolationLevel: 'Serializable' });
};

const getById = async (id, user) => {
  const closure = await loadClosure(prisma, id);
  if (!closure) throw new AppError('Cash closure not found', 404);
  if (user.role === 'MANAGER') {
    const ownAgencyId = await getActiveAgency(user).then((agency) => agency.id);
    if (closure.agencyId !== ownAgencyId) await assertReviewer(user, closure);
  } else await assertReviewer(user, closure);
  return toDto(closure);
};

const createCorrection = async (id, data, user) => {
  const agency = await getActiveAgency(user);
  const closure = await loadClosure(prisma, id);
  if (!closure || closure.agencyId !== agency.id) throw new AppError('Cash closure not found', 404);
  if (closure.status !== 'APPROVED') throw new AppError('Corrections can only be added to an approved closure', 409);
  const amountUsd = toCents(data?.amountUsd ?? '0', { allowNegative: true });
  const amountCdf = toCents(data?.amountCdf ?? '0', { allowNegative: true });
  const reason = typeof data?.reason === 'string' ? data.reason.trim() : '';
  if (!reason || (amountUsd === 0 && amountCdf === 0)) throw new AppError('A non-zero correction and reason are required', 400);
  return prisma.$transaction(async (tx) => {
    const correction = await tx.cashClosureCorrection.create({ data: { closureId: id, amountUsd: money(amountUsd), amountCdf: money(amountCdf), reason, createdById: user.id } });
    await saveEvent(tx, id, 'CORRECTION_SUBMITTED', user, { correctionId: correction.id, amountUsd: money(amountUsd), amountCdf: money(amountCdf), reason });
    return toDto(await loadClosure(tx, id));
  });
};

const reviewCorrection = async (id, correctionId, action, reason, user) => {
  const closure = await loadClosure(prisma, id);
  if (!closure) throw new AppError('Cash closure not found', 404);
  await assertReviewer(user, closure);
  const correction = closure.corrections.find((item) => item.id === correctionId);
  if (!correction || correction.status !== 'SUBMITTED') throw new AppError('Submitted correction not found', 404);
  if (action === 'REJECTED' && !String(reason || '').trim()) throw new AppError('A rejection reason is required', 400);
  return prisma.$transaction(async (tx) => {
    const changed = await tx.cashClosureCorrection.updateMany({
      where: { id: correctionId, closureId: id, status: 'SUBMITTED' },
      data: action === 'APPROVED'
        ? { status: 'APPROVED', reviewedById: user.id, reviewedAt: new Date() }
        : { status: 'REJECTED', reviewedById: user.id, reviewedAt: new Date(), rejectionReason: String(reason).trim() },
    });
    if (changed.count !== 1) throw new AppError('Correction changed concurrently; reload and retry', 409);
    await saveEvent(tx, id, 'CORRECTION_' + action, user, { correctionId, reason: action === 'REJECTED' ? String(reason).trim() : null });
    return toDto(await loadClosure(tx, id));
  }, { isolationLevel: 'Serializable' });
};

module.exports = { getForAgencyDay, saveDraft, submit, review, getById, createCorrection, reviewCorrection, calculateDay, classifyPayment, toCents, money };
