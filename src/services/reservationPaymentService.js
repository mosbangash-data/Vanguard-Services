const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const reservationPaymentRepository = require('../repositories/reservationPaymentRepository');
const prisma = require('../config/prisma');
const ticketService = require('./ticketService');
const { getUserAgencyId, assertAgencyAccess, assertDepartmentIdForUser } = require('./departmentAccessService');

const PAYMENT_VALIDATED_STATUSES = ['VERIFIED', 'COMPLETED'];
const RESERVATION_PAYABLE_STATUSES = ['PENDING', 'CONFIRMED'];

const normalizeMethod = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');

const parseMoneyToCents = (amount) => {
  const value = typeof amount === 'string' || typeof amount === 'number'
    ? amount
    : (amount && typeof amount.toString === 'function' ? amount.toString() : amount);

  if (value === undefined || value === null || value === '') {
    throw new AppError('Amount is required', 400);
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new AppError('Amount must be a positive number', 400);
  }

  const cents = Math.round(numberValue * 100);
  if (Math.abs(numberValue - cents / 100) > Number.EPSILON) {
    throw new AppError('Amount must have at most two decimal places', 400);
  }

  return cents;
};

const formatMoneyFromCents = (cents) => (cents / 100).toFixed(2);

const sumValidatedPayments = (payments = []) => payments
  .filter((payment) => PAYMENT_VALIDATED_STATUSES.includes(payment.status))
  .reduce((sum, payment) => sum + parseMoneyToCents(payment.amount), 0);

const getReservationWithTrip = async (reservationId) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      payments: true,
      trip: {
        include: {
          schedule: true,
        },
      },
    },
  });

  if (!reservation) throw new AppError('Reservation not found', 404);
  if (!reservation.trip) throw new AppError('Reservation relationship is invalid', 400);
  if (!reservation.trip.schedule) throw new AppError('Reservation schedule relationship is invalid', 400);
  return reservation;
};

const validatePaymentMethod = async (departmentId, method) => {
  const activeConfigCount = await prisma.paymentMethodConfig.count({
    where: { departmentId, isActive: true },
  });

  if (!activeConfigCount) return;

  const config = await prisma.paymentMethodConfig.findFirst({
    where: { departmentId, code: method, isActive: true },
  });

  if (!config) {
    throw new AppError('Payment method is not configured for this department', 400);
  }
};

const buildReservationFinancialSummary = (reservation) => {
  const totalAmountCents = parseMoneyToCents(reservation.totalAmount);
  const totalPaidCents = sumValidatedPayments(reservation.payments);
  const remainingCents = Math.max(totalAmountCents - totalPaidCents, 0);

  return {
    totalAmount: formatMoneyFromCents(totalAmountCents),
    totalPaid: formatMoneyFromCents(totalPaidCents),
    remainingAmount: formatMoneyFromCents(remainingCents),
  };
};

const assertSignedIn = (currentUser) => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
};

const assertCoachAccess = (currentUser) => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  if (currentUser.role !== 'SUPER_ADMIN' && currentUser.department?.type !== 'VANGUARD_COACH') {
    throw new AppError('Access denied', 403);
  }
};

const assertReservationDepartmentAccess = async (reservation, currentUser) => {
  await assertDepartmentIdForUser(currentUser, reservation.trip.schedule.departmentId, 'VANGUARD_COACH');
};

const assertReservationPaymentAgency = (reservation, payment, currentUser) => {
  const agencyId = reservation.agencyId || reservation.trip?.schedule?.agencyId;
  assertAgencyAccess(currentUser, agencyId);
  if (payment?.agencyId && agencyId && payment.agencyId !== agencyId) throw new AppError('Payment agency does not match reservation agency', 409);
  return agencyId;
};

const ensurePayableReservation = (reservation) => {
  if (!RESERVATION_PAYABLE_STATUSES.includes(reservation.status)) {
    throw new AppError('Reservation is not in a payable state', 409);
  }
};

const createReservationPayment = async (data, currentUser) => {
  assertCoachAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_RESERVATION_PAYMENT')) throw new AppError('Insufficient permissions', 403);

  const reservation = await getReservationWithTrip(data.reservationId);
  await assertReservationDepartmentAccess(reservation, currentUser);
  ensurePayableReservation(reservation);
  const reservationAgencyId = reservation.agencyId || reservation.trip?.schedule?.agencyId;
  assertAgencyAccess(currentUser, reservationAgencyId);
  if (data.agencyId && data.agencyId !== reservationAgencyId) throw new AppError('Payment agency must match the reservation agency', 409);

  const amountCents = parseMoneyToCents(data.amount);
  const method = normalizeMethod(data.method);
  if (!method) throw new AppError('Payment method is required', 400);
  if (method !== 'CASH' || (data.channel && String(data.channel).trim().toUpperCase() !== 'AGENCY')) {
    throw new AppError('Vanguard Coach reservation payments must be cash received at an agency', 409);
  }

  await validatePaymentMethod(reservation.trip.schedule.departmentId, method);

  const validatedPaidCents = sumValidatedPayments(reservation.payments);
  const totalAmountCents = parseMoneyToCents(reservation.totalAmount);
  const remainingCents = Math.max(totalAmountCents - validatedPaidCents, 0);
  if (amountCents > remainingCents) {
    throw new AppError('Amount cannot exceed remaining reservation balance', 400);
  }

  const channel = data.channel ? String(data.channel).trim().toUpperCase() : 'AGENCY';
  const provider = 'AGENCY';
  const currency = reservation.currency || 'USD';

  const paymentData = {
    reservationId: reservation.id,
    amount: formatMoneyFromCents(amountCents),
    currency,
    channel: channel === 'ONLINE' ? 'ONLINE' : 'AGENCY',
    provider,
    method,
    status: 'PENDING',
    reference: data.reference ? String(data.reference).trim() : null,
    comment: data.comment ? String(data.comment).trim() : null,
    agencyId: reservationAgencyId || null,
  };

  const payment = await prisma.$transaction(async (tx) => tx.payment.create({ data: paymentData }));

  await auditService.log('create_reservation_payment', currentUser.id, {
    targetReservationId: reservation.id,
    targetPaymentId: payment.id,
    agencyId: payment.agencyId,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
  });

  return { payment, reservation: { id: reservation.id, status: reservation.status, ...buildReservationFinancialSummary(reservation) } };
};

const listReservationPayments = async (reservationId, currentUser) => {
  assertCoachAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const reservation = await getReservationWithTrip(reservationId);
  await assertReservationDepartmentAccess(reservation, currentUser);
  assertReservationPaymentAgency(reservation, null, currentUser);
  const { items: payments, total } = await reservationPaymentRepository.listReservationPaymentsByReservationId({ reservationId });

  return {
    reservation: { id: reservation.id, status: reservation.status, ...buildReservationFinancialSummary(reservation) },
    payments,
    total,
  };
};

const listPendingReservationPayments = async ({ status = 'PENDING', page = 1, limit = 50 } = {}, currentUser) => {
  assertCoachAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_PAYMENT')) throw new AppError('Insufficient permissions', 403);
  const department = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' }, include: { settings: true } });
  if (!department) throw new AppError('Vanguard Coach department not found', 404);
  await assertDepartmentIdForUser(currentUser, department.id, 'VANGUARD_COACH');
  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const skip = Math.max((Number(page) || 1) - 1, 0) * take;
  const validStatuses = ['PENDING', 'PROCESSING', 'VERIFIED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'REJECTED'];
  if (!validStatuses.includes(status)) throw new AppError('Invalid payment status', 400);
  const { items, total } = await reservationPaymentRepository.listCoachReservationPayments({ departmentId: department.id, agencyId: ['AGENT', 'MANAGER'].includes(currentUser.role) ? getUserAgencyId(currentUser) : null, status, skip, take });
  return { payments: items.map(formatPayment), total, page: Number(page) || 1, currency: department.settings?.currency || 'USD' };
};

const getReservationPayment = async (paymentId, currentUser) => {
  assertCoachAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const payment = await reservationPaymentRepository.getReservationPaymentById(paymentId);
  if (!payment || !payment.reservation) throw new AppError('Reservation payment not found', 404);
  const reservation = await getReservationWithTrip(payment.reservationId);
  await assertReservationDepartmentAccess(reservation, currentUser);
  assertReservationPaymentAgency(reservation, payment, currentUser);

  return { payment };
};

const ensurePendingPayment = (payment) => {
  if (!payment) throw new AppError('Reservation payment not found', 404);
  if (payment.status !== 'PENDING') {
    throw new AppError('Only pending payments can be modified', 409);
  }
};

const updateReservationPayment = async (paymentId, data, currentUser) => {
  assertCoachAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_RESERVATION_PAYMENT')) throw new AppError('Insufficient permissions', 403);

  const payment = await reservationPaymentRepository.getReservationPaymentById(paymentId);
  ensurePendingPayment(payment);

  const reservation = await getReservationWithTrip(payment.reservationId);
  await assertReservationDepartmentAccess(reservation, currentUser);
  assertReservationPaymentAgency(reservation, payment, currentUser);
  ensurePayableReservation(reservation);

  const updatePayload = {};
  if (data.amount !== undefined) {
    const amountCents = parseMoneyToCents(data.amount);
    const validatedPaidCents = sumValidatedPayments(reservation.payments);
    const totalAmountCents = parseMoneyToCents(reservation.totalAmount);
    const remainingCents = Math.max(totalAmountCents - validatedPaidCents, 0);
    if (amountCents > remainingCents) {
      throw new AppError('Amount cannot exceed remaining reservation balance', 400);
    }
    updatePayload.amount = formatMoneyFromCents(amountCents);
  }

  if (data.method !== undefined) {
    const method = normalizeMethod(data.method);
    if (!method) throw new AppError('Payment method is required', 400);
    if (method !== 'CASH') throw new AppError('Vanguard Coach reservation payments must use CASH', 409);
    await validatePaymentMethod(reservation.trip.schedule.departmentId, method);
    updatePayload.method = method;
  }

  if (data.reference !== undefined) {
    updatePayload.reference = data.reference ? String(data.reference).trim() : null;
  }

  if (data.comment !== undefined) {
    updatePayload.comment = data.comment ? String(data.comment).trim() : null;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  const updated = await reservationPaymentRepository.updateReservationPayment(paymentId, updatePayload);
  await auditService.log('update_reservation_payment', currentUser.id, {
    targetReservationId: reservation.id,
    targetPaymentId: paymentId,
    changes: updatePayload,
  });

  return { payment: formatPayment(updated) };
};

const formatPayment = (payment) => {
  if (!payment) return payment;
  const formatted = { ...payment };
  if (formatted.amount !== undefined && formatted.amount !== null) {
    formatted.amount = formatMoneyFromCents(parseMoneyToCents(formatted.amount));
  }
  return formatted;
};

const validateReservationPayment = async (paymentId, currentUser, options = {}) => {
  assertCoachAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_RESERVATION_PAYMENT')) throw new AppError('Insufficient permissions', 403);

  const payment = await reservationPaymentRepository.getReservationPaymentById(paymentId);
  ensurePendingPayment(payment);

  const reservation = await getReservationWithTrip(payment.reservationId);
  await assertReservationDepartmentAccess(reservation, currentUser);
  ensurePayableReservation(reservation);

  const userAgencyId = getUserAgencyId(currentUser);
  const reservationAgencyId = reservation.agencyId || reservation.trip?.schedule?.agencyId;
  const resolvedAgencyId = ['AGENT', 'MANAGER'].includes(currentUser.role) ? userAgencyId : (payment.agencyId || reservationAgencyId);
  if (!resolvedAgencyId) {
    throw new AppError('Payment is not associated with a valid agency.', 400);
  }

  assertReservationPaymentAgency(reservation, payment, currentUser);

  if (payment.method !== 'CASH') {
    throw new AppError('This endpoint only validates agency cash payments.', 409);
  }

  const validatedPaidCents = sumValidatedPayments(reservation.payments);
  const totalAmountCents = parseMoneyToCents(reservation.totalAmount);
  const paymentCents = parseMoneyToCents(payment.amount);
  const remainingCents = Math.max(totalAmountCents - validatedPaidCents, 0);
  if (paymentCents > remainingCents) {
    throw new AppError('Payment amount exceeds remaining reservation balance', 400);
  }

  let ticketResult;
  try {
    ticketResult = await prisma.$transaction(async (tx) => {
    const currentReservation = await tx.reservation.findUnique({ where: { id: reservation.id }, include: { payments: true } });
    if (!currentReservation || !RESERVATION_PAYABLE_STATUSES.includes(currentReservation.status)) throw new AppError('Reservation is not in a payable state', 409);
    const currentPayment = currentReservation.payments.find((item) => item.id === paymentId);
    if (!currentPayment || currentPayment.status !== 'PENDING') throw new AppError('Payment has already been processed', 409);
    const paidBefore = sumValidatedPayments(currentReservation.payments);
    const totalCents = parseMoneyToCents(currentReservation.totalAmount);
    const amountCents = parseMoneyToCents(currentPayment.amount);
    if (paidBefore + amountCents > totalCents) throw new AppError('Payment amount exceeds remaining reservation balance', 409);
    const changed = await tx.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: {
        status: 'VERIFIED',
        validatedById: currentUser.id,
        validatedAt: new Date(),
        agencyId: resolvedAgencyId,
        channel: 'AGENCY',
        method: 'CASH',
      },
    });
    if (changed.count !== 1) throw new AppError('Payment has already been processed', 409);

    if (!reservation.agencyId) {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { agencyId: resolvedAgencyId },
      });
    }

    const fullyPaid = paidBefore + amountCents >= totalCents;
    if (fullyPaid && currentReservation.status === 'PENDING') {
      await tx.reservation.update({ where: { id: reservation.id }, data: { status: 'CONFIRMED' } });
    }
    const ticketResult = fullyPaid
      ? await ticketService.createTicketForReservationInTransaction(tx, reservation.id, currentUser)
      : null;

    const updated = await tx.payment.findUnique({ where: { id: paymentId } });
    await tx.auditLog.create({
      data: {
        action: 'validate_reservation_payment',
        actorId: currentUser.id,
        details: {
          targetReservationId: reservation.id,
          targetPaymentId: paymentId,
          targetTicketId: ticketResult?.ticket.id || null,
          amount: updated.amount,
          status: updated.status,
          agencyId: resolvedAgencyId,
        },
      },
    });
    return { payment: updated, ticket: ticketResult?.ticket || null, created: ticketResult?.created || false };
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error?.code === 'P2034') throw new AppError('Payment was processed concurrently; refresh the reservation and retry.', 409);
    throw error;
  }

  if (ticketResult.created && ticketResult.ticket) {
    await ticketService.notifyCustomerAboutTicket(ticketResult.ticket);
  }

  return {
    payment: formatPayment(ticketResult.payment),
    ticket: ticketResult.ticket ? await ticketService.getTicketByCode(ticketResult.ticket.ticketCode, currentUser) : null,
  };
};

const getReservationPaymentReceipt = async (paymentId, currentUser) => {
  assertCoachAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_PAYMENT')) throw new AppError('Insufficient permissions', 403);

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      agency: true,
      validatedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      reservation: {
        include: {
          trip: {
            include: {
              schedule: {
                include: { route: true, bus: true },
              },
            },
          },
          tickets: true,
        },
      },
    },
  });

  if (!payment) throw new AppError('Payment not found', 404);
  if (!payment.reservation) throw new AppError('Reservation payment relationship is invalid', 400);

  await assertReservationDepartmentAccess(payment.reservation, currentUser);
  const receiptAgencyId = assertReservationPaymentAgency(payment.reservation, payment, currentUser);

  let agencyData = payment.agency;
  if (!agencyData && receiptAgencyId) {
    agencyData = await prisma.agency.findUnique({ where: { id: receiptAgencyId } });
  }

  return {
    receiptNumber: `REC-${payment.id.slice(-8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
    paymentId: payment.id,
    paymentReference: payment.reference || payment.id,
    reservationCode: payment.reservation.reservationCode,
    customerName: payment.reservation.customerName,
    customerPhone: payment.reservation.customerPhone,
    amount: formatMoneyFromCents(parseMoneyToCents(payment.amount)),
    currency: payment.currency,
    method: payment.method,
    channel: payment.channel,
    status: payment.status,
    agency: agencyData
      ? {
          id: agencyData.id,
          name: agencyData.name,
          code: agencyData.code,
          city: agencyData.city,
          address: agencyData.address,
          phone: agencyData.phone,
        }
      : null,
    validatedBy: payment.validatedBy
      ? `${payment.validatedBy.firstName || ''} ${payment.validatedBy.lastName || ''}`.trim() || payment.validatedBy.email
      : 'N/A',
    validatedAt: payment.validatedAt || payment.createdAt,
    route: payment.reservation.trip?.schedule?.route
      ? `${payment.reservation.trip.schedule.route.departureCity} → ${payment.reservation.trip.schedule.route.arrivalCity}`
      : 'N/A',
    seatNumber: payment.reservation.seatNumber,
    ticketCode: payment.reservation.tickets?.[0]?.ticketCode || null,
  };
};

const rejectReservationPayment = async (paymentId, currentUser, reason = null) => {
  assertCoachAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_RESERVATION_PAYMENT')) throw new AppError('Insufficient permissions', 403);

  const payment = await reservationPaymentRepository.getReservationPaymentById(paymentId);
  ensurePendingPayment(payment);
  const reservation = await getReservationWithTrip(payment.reservationId);
  await assertReservationDepartmentAccess(reservation, currentUser);
  const effectiveAgencyId = assertReservationPaymentAgency(reservation, payment, currentUser);

  const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
  if (!normalizedReason) throw new AppError('A rejection reason is required', 400);
  const updatePayload = {
    status: 'REJECTED',
    validatedById: currentUser.id,
    validatedAt: new Date(),
  };
  updatePayload.comment = normalizedReason;

  const updatedPayment = await prisma.$transaction(async (tx) => {
    const changed = await tx.payment.updateMany({ where: { id: paymentId, status: 'PENDING' }, data: updatePayload });
    if (changed.count !== 1) throw new AppError('Payment has already been processed', 409);
    const updated = await tx.payment.findUnique({ where: { id: paymentId } });
    await tx.auditLog.create({ data: { action: 'reject_reservation_payment', actorId: currentUser.id, details: {
      targetReservationId: payment.reservationId,
      targetPaymentId: paymentId,
      comment: updated.comment,
      agencyId: effectiveAgencyId,
    } } });
    return updated;
  }, { isolationLevel: 'Serializable' });

  return { payment: formatPayment(updatedPayment) };
};

const cancelReservationPayment = async (paymentId, currentUser, reason = 'Payment cancelled by user') => {
  return rejectReservationPayment(paymentId, currentUser, reason);
};

module.exports = {
  createReservationPayment,
  listReservationPayments,
  listPendingReservationPayments,
  getReservationPayment,
  updateReservationPayment,
  validateReservationPayment,
  getReservationPaymentReceipt,
  rejectReservationPayment,
  cancelReservationPayment,
};
