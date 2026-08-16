const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const vehicleReservationRepository = require('../repositories/vehicleReservationRepository');
const vehiclePaymentRepository = require('../repositories/vehiclePaymentRepository');
const prisma = require('../config/prisma');

const PAYMENT_VALIDATED_STATUSES = ['VERIFIED', 'COMPLETED'];
const RESERVATION_ACCEPTED_STATUSES = ['PENDING', 'CONFIRMED'];

const assertAutoSalesAccess = (currentUser) => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  if (currentUser.role !== 'SUPER_ADMIN' && currentUser.department?.type !== 'AUTO_SALES') {
    throw new AppError('Access denied', 403);
  }
};

const normalizeMethod = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');

const enforcePaymentOwnership = (currentUser, payment) => {
  if (['AGENT', 'SALES_AGENT'].includes(currentUser.role) && payment.vehicleReservation?.createdByUserId !== currentUser.id) {
    throw new AppError('Access denied', 403);
  }
};

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

const getReservationWithVehicle = async (reservationId) => {
  const reservation = await vehicleReservationRepository.getVehicleReservationById(reservationId);
  if (!reservation) throw new AppError('Vehicle reservation not found', 404);
  if (!reservation.vehicle) throw new AppError('Vehicle reservation relationship is invalid', 400);
  return reservation;
};

const validatePaymentMethod = async (departmentId, method) => {
  const activeConfigCount = await prisma.paymentMethodConfig.count({
    where: { departmentId, isActive: true },
  });

  if (!activeConfigCount) {
    return;
  }

  const config = await prisma.paymentMethodConfig.findFirst({
    where: { departmentId, code: method, isActive: true },
  });

  if (!config) {
    throw new AppError('Payment method is not configured for this department', 400);
  }
};

const buildReservationFinancialSummary = (reservation) => {
  const reservationAmountCents = parseMoneyToCents(reservation.reservationAmount);
  const totalPaidCents = sumValidatedPayments(reservation.payments);
  const remainingCents = Math.max(reservationAmountCents - totalPaidCents, 0);

  return {
    reservationAmount: formatMoneyFromCents(reservationAmountCents),
    totalPaid: formatMoneyFromCents(totalPaidCents),
    remainingAmount: formatMoneyFromCents(remainingCents),
  };
};

const createVehiclePayment = async (data, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_VEHICLE_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const reservation = await getReservationWithVehicle(data.reservationId);
  if (!RESERVATION_ACCEPTED_STATUSES.includes(reservation.status)) {
    throw new AppError('Vehicle reservation is not in a payable state', 409);
  }
  if (['AGENT', 'SALES_AGENT'].includes(currentUser.role) && reservation.createdByUserId !== currentUser.id) {
    throw new AppError('Access denied', 403);
  }

  const amountCents = parseMoneyToCents(data.amount);
  const method = normalizeMethod(data.method);
  if (!method) throw new AppError('Payment method is required', 400);

  await validatePaymentMethod(reservation.vehicle.departmentId, method);

  const validatedPaidCents = sumValidatedPayments(reservation.payments);
  const reservationAmountCents = parseMoneyToCents(reservation.reservationAmount);
  const remainingCents = Math.max(reservationAmountCents - validatedPaidCents, 0);

  if (amountCents > remainingCents) {
    throw new AppError('Amount cannot exceed remaining reservation balance', 400);
  }

  const reference = data.reference ? String(data.reference).trim() : null;
  const comment = data.comment ? String(data.comment).trim() : null;

  const paymentData = {
    vehicleReservationId: reservation.id,
    amount: formatMoneyFromCents(amountCents),
    method,
    status: 'PENDING',
    reference,
    comment,
  };

  const payment = await prisma.$transaction(async (tx) => {
    const createdPayment = await tx.payment.create({ data: paymentData });
    return createdPayment;
  });

  await auditService.log('create_vehicle_payment', currentUser.id, {
    targetVehicleReservationId: reservation.id,
    targetPaymentId: payment.id,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
  });

  const summary = buildReservationFinancialSummary(reservation);
  return { payment, reservation: { id: reservation.id, paymentStatus: reservation.paymentStatus, ...summary } };
};

const listVehiclePayments = async (reservationId, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const reservation = await getReservationWithVehicle(reservationId);
  if (['AGENT', 'SALES_AGENT'].includes(currentUser.role) && reservation.createdByUserId !== currentUser.id) {
    throw new AppError('Access denied', 403);
  }

  const { items: payments, total } = await vehiclePaymentRepository.listVehiclePaymentsByReservationId({ reservationId });
  const summary = buildReservationFinancialSummary(reservation);

  return {
    reservation: {
      id: reservation.id,
      paymentStatus: reservation.paymentStatus,
      status: reservation.status,
      ...summary,
    },
    payments,
    total,
  };
};

const getVehiclePayment = async (paymentId, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const payment = await vehiclePaymentRepository.getVehiclePaymentById(paymentId);
  if (!payment || !payment.vehicleReservation) throw new AppError('Vehicle payment not found', 404);
  enforcePaymentOwnership(currentUser, payment);

  return { payment };
};

const ensurePendingPayment = (payment) => {
  if (!payment) throw new AppError('Vehicle payment not found', 404);
  if (payment.status !== 'PENDING') {
    throw new AppError('Only pending payments can be modified', 409);
  }
};

const updateVehiclePayment = async (paymentId, data, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_VEHICLE_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const payment = await vehiclePaymentRepository.getVehiclePaymentById(paymentId);
  ensurePendingPayment(payment);
  enforcePaymentOwnership(currentUser, payment);

  const reservation = await getReservationWithVehicle(payment.vehicleReservationId);
  if (!RESERVATION_ACCEPTED_STATUSES.includes(reservation.status)) {
    throw new AppError('Vehicle reservation is not in a payable state', 409);
  }
  if (['AGENT', 'SALES_AGENT'].includes(currentUser.role) && reservation.createdByUserId !== currentUser.id) {
    throw new AppError('Access denied', 403);
  }

  const updatePayload = {};
  if (data.amount !== undefined) {
    const amountCents = parseMoneyToCents(data.amount);
    const validatedPaidCents = sumValidatedPayments(reservation.payments);
    const reservationAmountCents = parseMoneyToCents(reservation.reservationAmount);
    const remainingCents = Math.max(reservationAmountCents - validatedPaidCents, 0);
    if (amountCents > remainingCents) {
      throw new AppError('Amount cannot exceed remaining reservation balance', 400);
    }
    updatePayload.amount = formatMoneyFromCents(amountCents);
  }

  if (data.method !== undefined) {
    const method = normalizeMethod(data.method);
    if (!method) throw new AppError('Payment method is required', 400);
    await validatePaymentMethod(reservation.vehicle.departmentId, method);
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

  const updated = await vehiclePaymentRepository.updateVehiclePayment(paymentId, updatePayload);
  await auditService.log('update_vehicle_payment', currentUser.id, {
    targetVehicleReservationId: reservation.id,
    targetPaymentId: paymentId,
    changes: updatePayload,
  });

  return { payment: updated };
};

const maybeUpdateReservationPaymentStatus = async (tx, reservationId) => {
  const reservation = await tx.vehicleReservation.findUnique({
    where: { id: reservationId },
    include: { payments: true },
  });
  if (!reservation) throw new AppError('Vehicle reservation not found', 404);

  const reservationAmountCents = parseMoneyToCents(reservation.reservationAmount);
  const totalPaidCents = sumValidatedPayments(reservation.payments);
  const newStatus = totalPaidCents >= reservationAmountCents ? 'COMPLETED' : (totalPaidCents > 0 ? 'VERIFIED' : 'PENDING');

  if (reservation.paymentStatus !== newStatus) {
    await tx.vehicleReservation.update({
      where: { id: reservationId },
      data: { paymentStatus: newStatus },
    });
  }
};

const validateVehiclePayment = async (paymentId, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_VEHICLE_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const payment = await vehiclePaymentRepository.getVehiclePaymentById(paymentId);
  ensurePendingPayment(payment);
  enforcePaymentOwnership(currentUser, payment);

  const reservation = await getReservationWithVehicle(payment.vehicleReservationId);
  if (!RESERVATION_ACCEPTED_STATUSES.includes(reservation.status)) {
    throw new AppError('Vehicle reservation is not in a payable state', 409);
  }
  if (['AGENT', 'SALES_AGENT'].includes(currentUser.role) && reservation.createdByUserId !== currentUser.id) {
    throw new AppError('Access denied', 403);
  }

  const validatedPaidCents = sumValidatedPayments(reservation.payments);
  const reservationAmountCents = parseMoneyToCents(reservation.reservationAmount);
  const paymentCents = parseMoneyToCents(payment.amount);
  const remainingCents = Math.max(reservationAmountCents - validatedPaidCents, 0);

  if (paymentCents > remainingCents) {
    throw new AppError('Payment amount exceeds remaining reservation balance', 400);
  }

  const updatedPayment = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'VERIFIED',
        validatedById: currentUser.id,
        validatedAt: new Date(),
      },
    });

    await maybeUpdateReservationPaymentStatus(tx, reservation.id);
    return result;
  });

  await auditService.log('validate_vehicle_payment', currentUser.id, {
    targetVehicleReservationId: reservation.id,
    targetPaymentId: paymentId,
    amount: updatedPayment.amount,
    status: updatedPayment.status,
  });

  return { payment: updatedPayment };
};

const rejectVehiclePayment = async (paymentId, currentUser, reason = null) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_VEHICLE_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const payment = await vehiclePaymentRepository.getVehiclePaymentById(paymentId);
  ensurePendingPayment(payment);
  enforcePaymentOwnership(currentUser, payment);

  const updatePayload = {
    status: 'REJECTED',
    validatedById: currentUser.id,
    validatedAt: new Date(),
  };
  if (reason) updatePayload.comment = String(reason).trim();

  const updatedPayment = await vehiclePaymentRepository.updateVehiclePayment(paymentId, updatePayload);
  await auditService.log('reject_vehicle_payment', currentUser.id, {
    targetVehicleReservationId: payment.vehicleReservationId,
    targetPaymentId: paymentId,
    comment: updatedPayment.comment,
  });

  return { payment: updatedPayment };
};

const cancelVehiclePayment = async (paymentId, currentUser, reason = 'Payment cancelled by user') => {
  return rejectVehiclePayment(paymentId, currentUser, reason);
};

module.exports = {
  createVehiclePayment,
  listVehiclePayments,
  getVehiclePayment,
  updateVehiclePayment,
  validateVehiclePayment,
  rejectVehiclePayment,
  cancelVehiclePayment,
};
