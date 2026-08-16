const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const reservationPaymentRepository = require('../repositories/reservationPaymentRepository');
const prisma = require('../config/prisma');
const ticketService = require('./ticketService');
const { assertDepartmentIdForUser } = require('./departmentAccessService');

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

  const amountCents = parseMoneyToCents(data.amount);
  const method = normalizeMethod(data.method);
  if (!method) throw new AppError('Payment method is required', 400);

  await validatePaymentMethod(reservation.trip.schedule.departmentId, method);

  const validatedPaidCents = sumValidatedPayments(reservation.payments);
  const totalAmountCents = parseMoneyToCents(reservation.totalAmount);
  const remainingCents = Math.max(totalAmountCents - validatedPaidCents, 0);
  if (amountCents > remainingCents) {
    throw new AppError('Amount cannot exceed remaining reservation balance', 400);
  }

  const paymentData = {
    reservationId: reservation.id,
    amount: formatMoneyFromCents(amountCents),
    method,
    status: 'PENDING',
    reference: data.reference ? String(data.reference).trim() : null,
    comment: data.comment ? String(data.comment).trim() : null,
  };

  const payment = await prisma.$transaction(async (tx) => tx.payment.create({ data: paymentData }));

  await auditService.log('create_reservation_payment', currentUser.id, {
    targetReservationId: reservation.id,
    targetPaymentId: payment.id,
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
  const validStatuses = ['PENDING', 'VERIFIED', 'REJECTED', 'COMPLETED'];
  if (!validStatuses.includes(status)) throw new AppError('Invalid payment status', 400);
  const { items, total } = await reservationPaymentRepository.listCoachReservationPayments({ departmentId: department.id, status, skip, take });
  return { payments: items.map(formatPayment), total, page: Number(page) || 1, currency: department.settings?.currency || 'USD' };
};

const getReservationPayment = async (paymentId, currentUser) => {
  assertCoachAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const payment = await reservationPaymentRepository.getReservationPaymentById(paymentId);
  if (!payment || !payment.reservation) throw new AppError('Reservation payment not found', 404);
  await assertReservationDepartmentAccess(await getReservationWithTrip(payment.reservationId), currentUser);

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

const maybeConfirmReservation = async (tx, reservation, paymentCents = 0) => {
  if (reservation.status !== 'PENDING') return;
  const totalAmountCents = parseMoneyToCents(reservation.totalAmount);
  const totalPaidCents = sumValidatedPayments(reservation.payments) + paymentCents;
  if (totalPaidCents > 0) {
    await tx.reservation.update({ where: { id: reservation.id }, data: { status: 'CONFIRMED' } });
  }
};

const formatPayment = (payment) => {
  if (!payment) return payment;
  const formatted = { ...payment };
  if (formatted.amount !== undefined && formatted.amount !== null) {
    formatted.amount = formatMoneyFromCents(parseMoneyToCents(formatted.amount));
  }
  return formatted;
};

const validateReservationPayment = async (paymentId, currentUser) => {
  assertCoachAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_RESERVATION_PAYMENT')) throw new AppError('Insufficient permissions', 403);

  const payment = await reservationPaymentRepository.getReservationPaymentById(paymentId);
  ensurePendingPayment(payment);

  const reservation = await getReservationWithTrip(payment.reservationId);
  await assertReservationDepartmentAccess(reservation, currentUser);
  ensurePayableReservation(reservation);

  const validatedPaidCents = sumValidatedPayments(reservation.payments);
  const totalAmountCents = parseMoneyToCents(reservation.totalAmount);
  const paymentCents = parseMoneyToCents(payment.amount);
  const remainingCents = Math.max(totalAmountCents - validatedPaidCents, 0);
  if (paymentCents > remainingCents) {
    throw new AppError('Payment amount exceeds remaining reservation balance', 400);
  }

  const ticketResult = await prisma.$transaction(async (tx) => {
    // The conditional update makes validation safe when two agents submit at once.
    const changed = await tx.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: {
        status: 'VERIFIED',
        validatedById: currentUser.id,
        validatedAt: new Date(),
      },
    });
    if (changed.count !== 1) throw new AppError('Payment has already been processed', 409);

    await maybeConfirmReservation(tx, reservation, paymentCents);
    const confirmedReservation = await tx.reservation.findUnique({ where: { id: reservation.id }, select: { status: true } });
    if (confirmedReservation?.status !== 'CONFIRMED') {
      throw new AppError('Ticket can only be generated for confirmed reservations', 409);
    }
    const ticketCode = `TCK-${require('crypto').randomUUID()}`;
    const ticket = await tx.ticket.upsert({
      where: { reservationId: reservation.id },
      update: {},
      create: {
        ticketCode,
        serialNumber: `SN-${Date.now()}-${require('crypto').randomInt(10000, 99999)}`,
        qrCode: `vanguard://ticket/${ticketCode}`,
        reservationId: reservation.id,
        status: 'VALID',
        issuedByUserId: currentUser.id,
      },
    });
    const updated = await tx.payment.findUnique({ where: { id: paymentId } });
    return { payment: updated, ticket, created: false };
  });

  await auditService.log('validate_reservation_payment', currentUser.id, {
    targetReservationId: reservation.id,
    targetPaymentId: paymentId,
    amount: ticketResult.payment.amount,
    status: ticketResult.payment.status,
  });

  if (ticketResult.created) {
    await ticketService.notifyCustomerAboutTicket(ticketResult.ticket);
  }

  return { payment: formatPayment(ticketResult.payment), ticket: await ticketService.getTicketByCode(ticketResult.ticket.ticketCode) };
};

const rejectReservationPayment = async (paymentId, currentUser, reason = null) => {
  assertCoachAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_RESERVATION_PAYMENT')) throw new AppError('Insufficient permissions', 403);

  const payment = await reservationPaymentRepository.getReservationPaymentById(paymentId);
  ensurePendingPayment(payment);
  await assertReservationDepartmentAccess(await getReservationWithTrip(payment.reservationId), currentUser);

  const updatePayload = {
    status: 'REJECTED',
    validatedById: currentUser.id,
    validatedAt: new Date(),
  };
  if (reason) updatePayload.comment = String(reason).trim();

  const updatedPayment = await reservationPaymentRepository.updateReservationPayment(paymentId, updatePayload);
  await auditService.log('reject_reservation_payment', currentUser.id, {
    targetReservationId: payment.reservationId,
    targetPaymentId: paymentId,
    comment: updatedPayment.comment,
  });

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
  rejectReservationPayment,
  cancelReservationPayment,
};
