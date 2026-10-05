const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { requireDepartmentType, getUserAgencyId, assertAgencyAccess, assertDepartmentIdForUser } = require('./departmentAccessService');

const assertCoachPermission = (currentUser, permission) => {
  requireDepartmentType(currentUser, 'VANGUARD_COACH');
  if (!currentUser.permissions.includes(permission)) throw new AppError('Insufficient permissions', 403);
  if (currentUser.role === 'AGENT' && !getUserAgencyId(currentUser)) throw new AppError('Agent agency assignment is required', 403);
};

const listReservations = async (query = {}, currentUser) => {
  assertCoachPermission(currentUser, 'VIEW_RESERVATION');
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Math.min(Number(query.limit), 100) : 20;
  const skip = (page - 1) * limit;

  const coachDept = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' }, select: { id: true } });
  const andClauses = [];

  if (currentUser.role !== 'SUPER_ADMIN' && coachDept) {
    andClauses.push({ trip: { schedule: { departmentId: coachDept.id } } });
  }

  if (currentUser.role === 'AGENT') {
    const agentAgencyId = getUserAgencyId(currentUser);
    andClauses.push({ OR: [
      { agencyId: agentAgencyId },
      { AND: [{ agencyId: null }, { trip: { schedule: { agencyId: agentAgencyId } } }] },
    ] });
  }

  if (query.tripId) andClauses.push({ tripId: query.tripId });
  if (query.customerPhone) andClauses.push({ customerPhone: query.customerPhone });
  if (query.search) {
    const search = String(query.search).trim();
    if (search) {
      andClauses.push({
        OR: [
          { reservationCode: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerPhone: { contains: search } },
        ],
      });
    }
  }

  const where = andClauses.length > 0 ? { AND: andClauses } : {};

  const [items, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        trip: { include: { schedule: { include: { route: true, bus: true } } } },
        payments: { select: { id: true, amount: true, channel: true, status: true, validatedAt: true } },
        tickets: { select: { id: true, ticketCode: true, status: true, qrCode: true } },
      },
    }),
    prisma.reservation.count({ where }),
  ]);

  return { items, page, limit, total };
};

const getReservationById = async (id, currentUser) => {
  assertCoachPermission(currentUser, 'VIEW_RESERVATION');
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      trip: { include: { schedule: { include: { route: true, bus: true } } } },
      payments: true,
      tickets: true,
    },
  });
  if (!reservation) throw new AppError('Reservation not found', 404);
  await assertDepartmentIdForUser(currentUser, reservation.trip.schedule.departmentId, 'VANGUARD_COACH');
  const effectiveAgencyId = reservation.agencyId || reservation.trip?.schedule?.agencyId;
  assertAgencyAccess(currentUser, effectiveAgencyId);
  return { reservation };
};

const createReservation = async (data, currentUser) => {
  assertCoachPermission(currentUser, 'CREATE_RESERVATION');
  const { tripId, customerName, customerPhone, customerEmail, seatNumber } = data;
  if (!tripId || !customerName || !customerPhone || !seatNumber) throw new AppError('Missing required fields', 400);

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { schedule: true } });
  if (!trip) throw new AppError('Trip not found', 404);
  if (trip.status !== 'SCHEDULED' || new Date(trip.departureAt) <= new Date()) throw new AppError('Trip is no longer available for reservations', 409);
  await assertDepartmentIdForUser(currentUser, trip.schedule.departmentId, 'VANGUARD_COACH');
  const agencyId = currentUser.role === 'AGENT' ? getUserAgencyId(currentUser) : (trip.schedule.agencyId || null);

  const bus = await prisma.bus.findUnique({ where: { id: trip.schedule.busId } });
  if (!bus) throw new AppError('Bus not found', 404);

  const num = Number(seatNumber);
  if (!Number.isFinite(num) || num < 1 || num > (bus.seats || 0)) throw new AppError('Invalid seat number', 400);

  // ensure seat not already reserved for trip
  const existing = await prisma.reservation.findFirst({ where: { tripId, seatNumber: String(seatNumber), status: { in: ['PENDING', 'CONFIRMED'] } } });
  if (existing) throw new AppError('Seat already reserved', 409);

  const reservationCode = `RSV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const totalAmount = String(trip.schedule.price ?? '0.00');

  if (currentUser.role === 'AGENT' && trip.schedule.agencyId && trip.schedule.agencyId !== agencyId) {
    throw new AppError('Trip does not belong to your agency', 403);
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: {
          reservationCode,
          tripId,
          agencyId: agencyId || trip.schedule.agencyId || null,
          customerName,
          customerPhone,
          customerEmail,
          seatNumber: String(seatNumber),
          totalAmount,
          status: 'PENDING',
          createdByUserId: currentUser.id,
        },
      });
      const settings = await tx.serviceSettings.findUnique({
        where: { departmentId: trip.schedule.departmentId },
        select: { currency: true },
      });
      const payment = await tx.payment.create({
        data: {
          reservationId: reservation.id,
          agencyId: reservation.agencyId,
          amount: reservation.totalAmount,
          currency: settings?.currency || 'USD',
          channel: 'AGENCY',
          method: 'CASH',
          provider: 'AGENCY',
          status: 'PENDING',
          reference: reservation.reservationCode,
          idempotencyKey: `reservation:${reservation.id}:initial-cash`,
          comment: 'Paiement en espèces à l’agence de départ',
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'create_reservation',
          actorId: currentUser.id,
          details: { targetReservationId: reservation.id, targetPaymentId: payment.id, paymentMethod: 'CASH', agencyId: reservation.agencyId, tripId, seatNumber: reservation.seatNumber },
        },
      });
      return { reservation, payment };
    });
  } catch (error) {
    if (error?.code === 'P2002') throw new AppError('Seat already reserved', 409);
    throw error;
  }
};

const updateReservation = async (id, data, currentUser) => {
  assertCoachPermission(currentUser, 'UPDATE_RESERVATION');
  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { trip: { include: { schedule: true } } } });
  if (!reservation) throw new AppError('Reservation not found', 404);
  await assertDepartmentIdForUser(currentUser, reservation.trip.schedule.departmentId, 'VANGUARD_COACH');
  const effectiveAgencyId = reservation.agencyId || reservation.trip?.schedule?.agencyId;
  assertAgencyAccess(currentUser, effectiveAgencyId);
  if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) throw new AppError('Only pending or confirmed reservations can be edited', 409);
  const editableFields = ['customerName', 'customerPhone', 'customerEmail'];
  const forbiddenFields = Object.keys(data || {}).filter((field) => !editableFields.includes(field));
  if (forbiddenFields.length) throw new AppError('Only passenger contact details can be edited; use the cancellation workflow for status changes', 400);
  const payload = {};
  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      const value = typeof data[field] === 'string' ? data[field].trim() : data[field];
      if (field !== 'customerEmail' && !value) throw new AppError(`${field} is required`, 400);
      payload[field] = value || null;
    }
  }
  if (!Object.keys(payload).length) throw new AppError('No editable fields provided', 400);

  const updated = await prisma.reservation.update({ where: { id }, data: payload });
  await auditService.log('update_reservation', currentUser.id, { targetReservationId: id, agencyId: effectiveAgencyId, changes: payload });
  return { reservation: updated };
};

const cancelReservation = async (id, data, currentUser) => {
  assertCoachPermission(currentUser, 'UPDATE_RESERVATION');
  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { trip: { include: { schedule: true } }, tickets: { select: { status: true } } } });
  if (!reservation) throw new AppError('Reservation not found', 404);
  await assertDepartmentIdForUser(currentUser, reservation.trip.schedule.departmentId, 'VANGUARD_COACH');
  const effectiveAgencyId = reservation.agencyId || reservation.trip?.schedule?.agencyId;
  assertAgencyAccess(currentUser, effectiveAgencyId);
  if (reservation.status === 'COMPLETED') throw new AppError('Completed reservations cannot be cancelled', 409);
  if (reservation.status === 'CANCELLED') throw new AppError('Reservation is already cancelled', 409);
  if (reservation.trip.status === 'IN_PROGRESS' || reservation.trip.status === 'COMPLETED' || new Date(reservation.trip.departureAt) <= new Date()) {
    throw new AppError('Reservations cannot be cancelled after departure has started', 409);
  }
  if (reservation.tickets.some((ticket) => ticket.status === 'USED')) throw new AppError('A reservation with an already used ticket cannot be cancelled', 409);
  const reason = typeof data?.reason === 'string' ? data.reason.trim() : '';
  if (!reason) throw new AppError('Cancellation reason is required', 400);
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.reservation.updateMany({ where: { id, status: reservation.status }, data: { status: 'CANCELLED' } });
    if (updated.count !== 1) throw new AppError('Reservation changed before cancellation; reload and try again', 409);
    await tx.reservationCancellation.create({ data: { reservationId: id, cancelledByUserId: currentUser.id, reason, status: 'APPROVED' } });
    await tx.ticket.updateMany({ where: { reservationId: id, status: 'VALID' }, data: { status: 'CANCELLED' } });
    await tx.auditLog.create({ data: { action: 'cancel_reservation', actorId: currentUser.id, details: { targetReservationId: id, reason, agencyId: effectiveAgencyId } } });
    return tx.reservation.findUnique({ where: { id }, include: { tickets: true, cancellations: true } });
  });
  return { reservation: result };
};

module.exports = { listReservations, getReservationById, createReservation, updateReservation, cancelReservation };
