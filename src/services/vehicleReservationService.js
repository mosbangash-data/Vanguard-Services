const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const vehicleRepository = require('../repositories/vehicleRepository');
const vehicleReservationRepository = require('../repositories/vehicleReservationRepository');
const prisma = require('../config/prisma');

const assertAutoSalesAccess = (currentUser) => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  if (currentUser.role !== 'SUPER_ADMIN' && currentUser.department?.type !== 'AUTO_SALES') {
    throw new AppError('Access denied', 403);
  }
};

const normalizePage = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const enforceReservationOwnership = (currentUser, reservation) => {
  if (['AGENT'].includes(currentUser.role) && reservation.createdByUserId !== currentUser.id) {
    throw new AppError('Access denied', 403);
  }
};

const normalizeLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  if (parsed < 1) return 1;
  return Math.min(parsed, 100);
};

const ACTIVE_RESERVATION_STATUSES = ['PENDING', 'CONFIRMED'];
const EXPIRED_RESERVATION_STATUS = 'EXPIRED';

const generateReservationCode = () => `VR-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

const listVehicleReservations = async (query = {}, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const skip = (page - 1) * limit;

  const where = {};
  if (query.vehicleId) where.vehicleId = query.vehicleId;
  if (query.status) where.status = query.status;
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
  if (query.createdByUserId) where.createdByUserId = query.createdByUserId;
  if (query.customerPhone) where.customerPhone = { contains: String(query.customerPhone).trim(), mode: 'insensitive' };
  if (query.customerEmail) where.customerEmail = { contains: String(query.customerEmail).trim(), mode: 'insensitive' };
  if (query.reservationCode) where.reservationCode = query.reservationCode;
  if (query.search) {
    const search = String(query.search).trim();
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { reservationCode: { contains: search, mode: 'insensitive' } },
      ];
    }
  }

  if (['AGENT'].includes(currentUser.role)) {
    where.createdByUserId = currentUser.id;
  }

  const { items, total } = await vehicleReservationRepository.listVehicleReservations({ where, skip, take: limit });
  return { items, page, limit, total };
};

const getVehicleReservationById = async (id, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const reservation = await vehicleReservationRepository.getVehicleReservationById(id);
  if (!reservation) throw new AppError('Vehicle reservation not found', 404);
  enforceReservationOwnership(currentUser, reservation);
  return { vehicleReservation: reservation };
};

const createVehicleReservation = async (data, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_VEHICLE_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId.trim() : null;
  const customerName = typeof data?.customerName === 'string' ? data.customerName.trim() : '';
  const customerPhone = typeof data?.customerPhone === 'string' ? data.customerPhone.trim() : '';
  const customerEmail = typeof data?.customerEmail === 'string' ? data.customerEmail.trim() : null;
  const reservationAmount = data?.reservationAmount !== undefined && data?.reservationAmount !== null ? String(data.reservationAmount).trim() : null;
  const depositAmount = data?.depositAmount !== undefined && data?.depositAmount !== null ? String(data.depositAmount).trim() : null;
  const reservationDate = data?.reservationDate ? new Date(data.reservationDate) : null;
  const expirationDate = data?.expirationDate ? new Date(data.expirationDate) : null;
  const status = data?.status ? String(data.status).trim().toUpperCase() : 'PENDING';
  const paymentStatus = data?.paymentStatus ? String(data.paymentStatus).trim().toUpperCase() : 'PENDING';

  if (!vehicleId || !customerName || !customerPhone || !reservationAmount || !reservationDate) {
    throw new AppError('vehicleId, customerName, customerPhone, reservationAmount and reservationDate are required', 400);
  }

  const amount = Number(reservationAmount);
  const deposit = depositAmount ? Number(depositAmount) : null;
  if (!Number.isFinite(amount) || amount < 0) throw new AppError('reservationAmount must be a valid positive number', 400);
  if (deposit !== null && (!Number.isFinite(deposit) || deposit < 0)) throw new AppError('depositAmount must be a valid positive number', 400);
  if (deposit !== null && deposit > amount) throw new AppError('depositAmount cannot exceed reservationAmount', 400);
  if (!Number.isFinite(reservationDate.getTime())) throw new AppError('reservationDate must be a valid date', 400);
  if (expirationDate !== null && !Number.isFinite(expirationDate.getTime())) throw new AppError('expirationDate must be a valid date', 400);
  if (expirationDate !== null && expirationDate <= reservationDate) throw new AppError('expirationDate must be after reservationDate', 400);

  const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'EXPIRED'];
  if (!validStatuses.includes(status)) throw new AppError('Invalid reservation status', 400);

  const validPaymentStatuses = ['PENDING', 'VERIFIED', 'REJECTED', 'COMPLETED'];
  if (!validPaymentStatuses.includes(paymentStatus)) throw new AppError('Invalid paymentStatus', 400);

  const vehicle = await vehicleRepository.getVehicleById(vehicleId);
  if (!vehicle) throw new AppError('Vehicle not found', 404);
  if (vehicle.status === 'SOLD') throw new AppError('Cannot reserve a sold vehicle', 409);

  if (['AGENT'].includes(currentUser.role) && currentUser.id) {
    // agent ownership is tracked on createdByUserId, so the created reservation remains scoped to the acting agent
  }

  const reservationPayload = {
    vehicleId,
    customerName,
    customerPhone,
    customerEmail,
    status,
    reservationAmount: amount,
    depositAmount: deposit,
    paymentStatus,
    reservationDate,
    expirationDate: expirationDate || null,
    createdByUserId: currentUser.id,
  };

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const lockedVehicleRows = await tx.$queryRaw`
      SELECT "id", "status"
      FROM "Vehicle"
      WHERE "id" = ${vehicleId}
      FOR UPDATE
    `;
    const lockedVehicle = Array.isArray(lockedVehicleRows) ? lockedVehicleRows[0] : lockedVehicleRows;
    if (!lockedVehicle) throw new AppError('Vehicle not found', 404);
    if (lockedVehicle.status === 'SOLD') throw new AppError('Cannot reserve a sold vehicle', 409);

    await tx.vehicleReservation.updateMany({
      where: {
        vehicleId,
        status: { in: ACTIVE_RESERVATION_STATUSES },
        expirationDate: { lt: now },
      },
      data: { status: EXPIRED_RESERVATION_STATUS },
    });

    const existingActive = await tx.vehicleReservation.findFirst({
      where: {
        vehicleId,
        status: { in: ACTIVE_RESERVATION_STATUSES },
      },
    });

    if (existingActive) throw new AppError('Vehicle is already reserved', 409);

    let reservation;
    let attempts = 0;
    while (!reservation && attempts < 5) {
      attempts += 1;
      const code = generateReservationCode();
      try {
        reservation = await tx.vehicleReservation.create({
          data: {
            ...reservationPayload,
            reservationCode: code,
          },
        });
      } catch (error) {
        if (error.code === 'P2002' && error.meta?.target?.includes('reservationCode')) {
          if (attempts >= 5) throw new AppError('Unable to generate unique reservation code', 500);
          continue;
        }
        throw error;
      }
    }

    await tx.vehicle.update({ where: { id: vehicleId }, data: { status: 'RESERVED' } });

    return reservation;
  });

  const createdReservation = await vehicleReservationRepository.getVehicleReservationById(result.id);
  await auditService.log('create_vehicle_reservation', currentUser.id, { targetVehicleReservationId: result.id, targetVehicleId: vehicleId });
  return { vehicleReservation: createdReservation };
};

const updateVehicleReservation = async (id, data, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_VEHICLE_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const existing = await vehicleReservationRepository.getVehicleReservationById(id);
  if (!existing) throw new AppError('Vehicle reservation not found', 404);
  enforceReservationOwnership(currentUser, existing);

  const updatePayload = {};
  if (data.status !== undefined) updatePayload.status = String(data.status).trim().toUpperCase();
  if (data.paymentStatus !== undefined) updatePayload.paymentStatus = String(data.paymentStatus).trim().toUpperCase();
  if (data.reservationAmount !== undefined) updatePayload.reservationAmount = Number(data.reservationAmount);
  if (data.depositAmount !== undefined) updatePayload.depositAmount = data.depositAmount !== null ? Number(data.depositAmount) : null;
  if (data.expirationDate !== undefined) updatePayload.expirationDate = data.expirationDate ? new Date(data.expirationDate) : null;
  if (data.customerName !== undefined) updatePayload.customerName = String(data.customerName).trim();
  if (data.customerPhone !== undefined) updatePayload.customerPhone = String(data.customerPhone).trim();
  if (data.customerEmail !== undefined) updatePayload.customerEmail = data.customerEmail ? String(data.customerEmail).trim() : null;
  if (data.reservationDate !== undefined) updatePayload.reservationDate = new Date(data.reservationDate);

  if (Object.keys(updatePayload).length === 0) throw new AppError('No valid fields provided for update', 400);

  if (updatePayload.reservationAmount !== undefined && (!Number.isFinite(updatePayload.reservationAmount) || updatePayload.reservationAmount < 0)) {
    throw new AppError('reservationAmount must be a valid positive number', 400);
  }
  if (updatePayload.depositAmount !== undefined && updatePayload.depositAmount !== null && (!Number.isFinite(updatePayload.depositAmount) || updatePayload.depositAmount < 0)) {
    throw new AppError('depositAmount must be a valid positive number', 400);
  }
  if (updatePayload.depositAmount !== undefined && updatePayload.reservationAmount !== undefined && updatePayload.depositAmount > updatePayload.reservationAmount) {
    throw new AppError('depositAmount cannot exceed reservationAmount', 400);
  }
  if (updatePayload.reservationDate !== undefined && !Number.isFinite(updatePayload.reservationDate.getTime())) {
    throw new AppError('reservationDate must be a valid date', 400);
  }
  if (updatePayload.expirationDate !== undefined && updatePayload.expirationDate !== null && !Number.isFinite(updatePayload.expirationDate.getTime())) {
    throw new AppError('expirationDate must be a valid date', 400);
  }
  if (updatePayload.expirationDate !== undefined && updatePayload.reservationDate !== undefined && updatePayload.expirationDate <= updatePayload.reservationDate) {
    throw new AppError('expirationDate must be after reservationDate', 400);
  }

  if (updatePayload.status !== undefined) {
    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'EXPIRED'];
    if (!validStatuses.includes(updatePayload.status)) throw new AppError('Invalid reservation status', 400);
  }
  if (updatePayload.paymentStatus !== undefined) {
    const validPaymentStatuses = ['PENDING', 'VERIFIED', 'REJECTED', 'COMPLETED'];
    if (!validPaymentStatuses.includes(updatePayload.paymentStatus)) throw new AppError('Invalid paymentStatus', 400);
  }

  const updated = await vehicleReservationRepository.updateVehicleReservation(id, updatePayload);

  if (updatePayload.status && updatePayload.status !== existing.status) {
    await auditService.log('vehicle_reservation_status_change', currentUser.id, { targetVehicleReservationId: id, previousStatus: existing.status, status: updatePayload.status });
  }
  if (updatePayload.reservationAmount !== undefined || updatePayload.depositAmount !== undefined) {
    await auditService.log('vehicle_reservation_financial_update', currentUser.id, { targetVehicleReservationId: id, changes: updatePayload });
  }

  if (updatePayload.status === 'CONFIRMED' && existing.vehicle.status === 'AVAILABLE') {
    await prisma.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'RESERVED' } });
    await auditService.log('vehicle_status_reserved', currentUser.id, { targetVehicleId: existing.vehicleId, targetVehicleReservationId: id });
  }
  if (updatePayload.status === 'COMPLETED') {
    await prisma.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'SOLD' } });
    await prisma.vehicleInquiry.updateMany({
      where: {
        vehicleId: existing.vehicleId,
        status: { in: ['NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'RESOLVED', 'CLOSED'] },
      },
      data: { status: 'CONVERTED' },
    });
    await auditService.log('vehicle_sold', currentUser.id, { targetVehicleId: existing.vehicleId, targetVehicleReservationId: id });
  }

  return { vehicleReservation: updated };
};

const cancelVehicleReservation = async (id, data, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('CANCEL_VEHICLE_RESERVATION')) throw new AppError('Insufficient permissions', 403);

  const existing = await vehicleReservationRepository.getVehicleReservationById(id);
  if (!existing) throw new AppError('Vehicle reservation not found', 404);
  enforceReservationOwnership(currentUser, existing);
  if (existing.status === 'CANCELLED') throw new AppError('Reservation is already cancelled', 400);
  if (existing.status === 'COMPLETED') throw new AppError('Cannot cancel a completed reservation', 400);

  const reason = typeof data?.reason === 'string' ? data.reason.trim() : null;
  const penaltyAmount = data?.penaltyAmount !== undefined && data?.penaltyAmount !== null ? Number(data.penaltyAmount) : null;
  const refundAmount = data?.refundAmount !== undefined && data?.refundAmount !== null ? Number(data.refundAmount) : null;

  if (penaltyAmount !== null && (!Number.isFinite(penaltyAmount) || penaltyAmount < 0)) throw new AppError('penaltyAmount must be a valid positive number', 400);
  if (refundAmount !== null && (!Number.isFinite(refundAmount) || refundAmount < 0)) throw new AppError('refundAmount must be a valid positive number', 400);

  const updatedReservation = await prisma.$transaction(async (tx) => {
    const cancellation = await tx.vehicleReservationCancellation.create({
      data: {
        vehicleReservationId: id,
        cancelledByUserId: currentUser.id,
        reason,
        penaltyAmount: penaltyAmount !== null ? penaltyAmount : null,
        refundAmount: refundAmount !== null ? refundAmount : null,
        status: 'COMPLETED',
      },
    });

    const reservation = await tx.vehicleReservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    const otherActive = await tx.vehicleReservation.findFirst({
      where: {
        vehicleId: reservation.vehicleId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        id: { not: id },
      },
    });

    const vehicle = await tx.vehicle.findUnique({ where: { id: reservation.vehicleId } });
    if (vehicle && vehicle.status === 'RESERVED' && !otherActive && reservation.status !== 'COMPLETED') {
      await tx.vehicle.update({ where: { id: reservation.vehicleId }, data: { status: 'AVAILABLE' } });
    }

    return reservation;
  });

  const cancelledDetails = await vehicleReservationRepository.getVehicleReservationById(id);
  await auditService.log('cancel_vehicle_reservation', currentUser.id, { targetVehicleReservationId: id, reason, penaltyAmount, refundAmount });
  return { vehicleReservation: cancelledDetails };
};

module.exports = {
  listVehicleReservations,
  getVehicleReservationById,
  createVehicleReservation,
  updateVehicleReservation,
  cancelVehicleReservation,
};