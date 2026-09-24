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
    andClauses.push({
      OR: [
        { agencyId: agentAgencyId },
        { trip: { schedule: { agencyId: agentAgencyId } } },
      ],
    });
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
  await assertDepartmentIdForUser(currentUser, trip.schedule.departmentId, 'VANGUARD_COACH');
  const agencyId = currentUser.role === 'AGENT' ? getUserAgencyId(currentUser) : (trip.schedule.agencyId || null);

  const bus = await prisma.bus.findUnique({ where: { id: trip.schedule.busId } });
  if (!bus) throw new AppError('Bus not found', 404);

  const num = Number(seatNumber);
  if (!Number.isFinite(num) || num < 1 || num > (bus.seats || 0)) throw new AppError('Invalid seat number', 400);

  // ensure seat not already reserved for trip
  const existing = await prisma.reservation.findFirst({ where: { tripId, seatNumber: String(seatNumber) } });
  if (existing) throw new AppError('Seat already reserved', 409);

  const reservationCode = `RSV-${Date.now()}`;
  const totalAmount = String(trip.schedule.price ?? '0.00');

  if (currentUser.role === 'AGENT' && trip.schedule.agencyId && trip.schedule.agencyId !== agencyId) {
    throw new AppError('Trip does not belong to your agency', 403);
  }
  const reservation = await prisma.reservation.create({
    data: {
      reservationCode,
      tripId,
      agencyId: agencyId || trip.schedule.agencyId || null,
      customerName,
      customerPhone,
      customerEmail,
      seatNumber: String(seatNumber),
      totalAmount,
      createdByUserId: currentUser.id,
    },
  });
  await auditService.log('create_reservation', currentUser.id, { targetReservationId: reservation.id });
  return { reservation };
};

const updateReservation = async (id, data, currentUser) => {
  assertCoachPermission(currentUser, 'UPDATE_RESERVATION');
  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { trip: { include: { schedule: true } } } });
  if (!reservation) throw new AppError('Reservation not found', 404);
  await assertDepartmentIdForUser(currentUser, reservation.trip.schedule.departmentId, 'VANGUARD_COACH');
  const effectiveAgencyId = reservation.agencyId || reservation.trip?.schedule?.agencyId;
  assertAgencyAccess(currentUser, effectiveAgencyId);
  const payload = {};
  if (data.status) payload.status = data.status;
  if (data.customerName) payload.customerName = data.customerName;
  if (data.customerPhone) payload.customerPhone = data.customerPhone;
  if (data.customerEmail) payload.customerEmail = data.customerEmail;

  const updated = await prisma.reservation.update({ where: { id }, data: payload });
  await auditService.log('update_reservation', currentUser.id, { targetReservationId: id });
  return { reservation: updated };
};

const deleteReservation = async (id, currentUser) => {
  assertCoachPermission(currentUser, 'UPDATE_RESERVATION');
  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { trip: { include: { schedule: true } } } });
  if (!reservation) throw new AppError('Reservation not found', 404);
  await assertDepartmentIdForUser(currentUser, reservation.trip.schedule.departmentId, 'VANGUARD_COACH');
  const effectiveAgencyId = reservation.agencyId || reservation.trip?.schedule?.agencyId;
  assertAgencyAccess(currentUser, effectiveAgencyId);
  await prisma.reservation.delete({ where: { id } });
  await auditService.log('delete_reservation', currentUser.id, { targetReservationId: id });
  return { success: true };
};

module.exports = { listReservations, getReservationById, createReservation, updateReservation, deleteReservation };
