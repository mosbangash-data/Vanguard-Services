const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { requireCoachAdmin, requireCoachOperational, getUserAgencyId, assertAgencyAccess, assertDepartmentIdForUser } = require('./departmentAccessService');

const normalizePage = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const normalizeLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  if (parsed < 1) return 1;
  return Math.min(parsed, 100);
};

const parseTimeToMinutes = (value) => {
  if (typeof value !== 'string') return null;
  const [hourText, minuteText] = value.split(':');
  const hours = Number(hourText);
  const minutes = Number(minuteText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const buildDepartureAtFromDateAndSchedule = (dateValue, schedule) => {
  if (!schedule || !schedule.departureTime) return null;
  const timeMinutes = parseTimeToMinutes(schedule.departureTime);
  if (timeMinutes === null) return null;

  const baseDate = new Date(dateValue);
  if (Number.isNaN(baseDate.getTime())) return null;

  baseDate.setHours(0, 0, 0, 0);
  const timestamp = new Date(baseDate);
  timestamp.setHours(Math.floor(timeMinutes / 60), timeMinutes % 60, 0, 0);
  return timestamp;
};

const listTrips = async (query = {}, currentUser) => {
  requireCoachOperational(currentUser, 'VIEW_TRIP');
  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const skip = (page - 1) * limit;

  const coachDept = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' }, select: { id: true } });
  const where = {};
  const scheduleWhere = {};
  if (currentUser.role !== 'SUPER_ADMIN' && coachDept) {
    scheduleWhere.departmentId = coachDept.id;
  }
  if (currentUser.role === 'AGENT') {
    scheduleWhere.agencyId = getUserAgencyId(currentUser);
  }
  if (Object.keys(scheduleWhere).length > 0) {
    where.schedule = scheduleWhere;
  }
  if (query.scheduleId) where.scheduleId = query.scheduleId;
  if (query.status) where.status = query.status;

  const [items, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      skip,
      take: limit,
      orderBy: { departureAt: 'desc' },
      include: {
        schedule: {
          include: {
            route: true,
            bus: true,
          },
        },
      },
    }),
    prisma.trip.count({ where }),
  ]);

  return { items, page, limit, total };
};

const getTripById = async (id, currentUser) => {
  requireCoachOperational(currentUser, 'VIEW_TRIP');
  const trip = await prisma.trip.findUnique({ where: { id }, include: { schedule: true } });
  if (!trip) throw new AppError('Trip not found', 404);
  await assertDepartmentIdForUser(currentUser, trip.schedule.departmentId, 'VANGUARD_COACH');
  if (currentUser.role === 'AGENT') assertAgencyAccess(currentUser, trip.schedule.agencyId);
  return { trip };
};

const createTrip = async (data, currentUser) => {
  requireCoachAdmin(currentUser);
  const scheduleId = typeof data?.scheduleId === 'string' ? data.scheduleId : null;
  if (!scheduleId) throw new AppError('scheduleId is required', 400);

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { route: true, bus: true },
  });
  if (!schedule) throw new AppError('Schedule not found', 404);
  if (schedule.status !== 'ACTIVE') throw new AppError('Schedule is not active', 409);
  if (!schedule.route) throw new AppError('Schedule route is missing', 400);
  if (schedule.route.status !== 'ACTIVE') throw new AppError('Schedule route is not active', 409);
  if (!schedule.bus) throw new AppError('Schedule bus is missing', 400);
  if (schedule.bus.status !== 'ACTIVE') throw new AppError('Schedule bus is not active', 409);
  await assertDepartmentIdForUser(currentUser, schedule.departmentId, 'VANGUARD_COACH');

  let departureAt = null;
  if (data?.date) {
    departureAt = buildDepartureAtFromDateAndSchedule(data.date, schedule);
  } else if (data?.departureAt) {
    const raw = new Date(data.departureAt);
    if (!Number.isNaN(raw.getTime())) {
      // Use the date portion of departureAt combined with schedule's departureTime
      const datePart = raw.toISOString().slice(0, 10);
      departureAt = buildDepartureAtFromDateAndSchedule(datePart, schedule) || raw;
    }
  }

  if (!departureAt || Number.isNaN(departureAt.getTime())) {
    throw new AppError('Valid date is required; the schedule departure time will be applied automatically', 400);
  }

  let arrivalAt = data?.arrivalAt ? new Date(data.arrivalAt) : null;
  if (!arrivalAt || Number.isNaN(arrivalAt.getTime())) {
    const durationHours = Number(schedule.route.durationHours) || 2;
    arrivalAt = new Date(departureAt.getTime() + durationHours * 60 * 60 * 1000);
  }

  if (arrivalAt <= departureAt) {
    throw new AppError('arrivalAt must be after departureAt', 400);
  }

  // Prevent duplicate trip for same schedule and departure time
  const existingTrip = await prisma.trip.findFirst({
    where: {
      scheduleId,
      departureAt,
      status: { not: 'CANCELLED' },
    },
  });
  if (existingTrip) {
    throw new AppError('A trip is already scheduled for this schedule at this date and time', 409);
  }

  // Check for bus scheduling conflicts
  const busConflict = await prisma.trip.findFirst({
    where: {
      schedule: { busId: schedule.busId },
      status: { not: 'CANCELLED' },
      departureAt: { lt: arrivalAt },
      arrivalAt: { gt: departureAt },
    },
  });
  if (busConflict) {
    throw new AppError(`Bus ${schedule.bus.plateNumber} is already scheduled on another trip during this time window`, 409);
  }

  const status = data?.status && ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(data.status)
    ? data.status
    : 'SCHEDULED';

  const trip = await prisma.trip.create({ data: { scheduleId, departureAt, arrivalAt, status } });
  await auditService.log('create_trip', currentUser.id, { targetTripId: trip.id });
  return { trip };
};

const updateTrip = async (id, data, currentUser) => {
  requireCoachAdmin(currentUser);
  const trip = await prisma.trip.findUnique({ where: { id }, include: { schedule: true } });
  if (!trip) throw new AppError('Trip not found', 404);
  await assertDepartmentIdForUser(currentUser, trip.schedule.departmentId, 'VANGUARD_COACH');

  const updatePayload = {};
  if (data?.departureAt !== undefined) updatePayload.departureAt = new Date(data.departureAt);
  if (data?.arrivalAt !== undefined) updatePayload.arrivalAt = new Date(data.arrivalAt);
  if (data?.status !== undefined) updatePayload.status = data.status;

  const updated = await prisma.trip.update({ where: { id }, data: updatePayload });
  await auditService.log('update_trip', currentUser.id, { targetTripId: id });
  return { trip: updated };
};

const deleteTrip = async (id, currentUser) => {
  requireCoachAdmin(currentUser);
  const trip = await prisma.trip.findUnique({ where: { id }, include: { schedule: true } });
  if (!trip) throw new AppError('Trip not found', 404);
  await assertDepartmentIdForUser(currentUser, trip.schedule.departmentId, 'VANGUARD_COACH');

  await prisma.trip.delete({ where: { id } });
  await auditService.log('delete_trip', currentUser.id, { targetTripId: id });
  return { success: true };
};

module.exports = { listTrips, getTripById, createTrip, updateTrip, deleteTrip };
