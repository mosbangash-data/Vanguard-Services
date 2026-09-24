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

  const where = {};
  if (currentUser.role !== 'SUPER_ADMIN') where.schedule = { department: { type: 'VANGUARD_COACH' } };
  if (currentUser.role === 'AGENT') where.schedule.agencyId = getUserAgencyId(currentUser);
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
  if (!schedule.bus) throw new AppError('Schedule bus is missing', 400);
  await assertDepartmentIdForUser(currentUser, schedule.departmentId, 'VANGUARD_COACH');

  let departureAt = data?.departureAt ? new Date(data.departureAt) : null;
  if (data?.date && !departureAt) {
    departureAt = buildDepartureAtFromDateAndSchedule(data.date, schedule);
  }
  if (!departureAt && schedule.departureTime && data?.date) {
    departureAt = buildDepartureAtFromDateAndSchedule(data.date, schedule);
  }
  if (!departureAt && schedule.departureTime && data?.departureTime) {
    const dateValue = data?.date || new Date().toISOString().slice(0, 10);
    departureAt = buildDepartureAtFromDateAndSchedule(dateValue, { departureTime: data.departureTime });
  }
  if (!departureAt && data?.departureAt === undefined && data?.date === undefined) {
    throw new AppError('date or departureAt is required; the schedule departureTime will be used automatically', 400);
  }
  if (departureAt && Number.isNaN(departureAt.getTime())) {
    throw new AppError('departureAt is invalid', 400);
  }

  let arrivalAt = data?.arrivalAt ? new Date(data.arrivalAt) : null;
  if (!arrivalAt && schedule.route.durationHours) {
    const durationHours = Number(schedule.route.durationHours);
    if (Number.isFinite(durationHours) && durationHours > 0 && departureAt) {
      arrivalAt = new Date(departureAt.getTime() + durationHours * 60 * 60 * 1000);
    }
  }
  if (!arrivalAt) {
    throw new AppError('arrivalAt is required or the route duration must be available for automatic calculation', 400);
  }

  const trip = await prisma.trip.create({ data: { scheduleId, departureAt, arrivalAt } });
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
