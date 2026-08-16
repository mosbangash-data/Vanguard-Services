const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { requireCoachAdmin, assertDepartmentIdForUser } = require('./departmentAccessService');

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

const listTrips = async (query = {}, currentUser) => {
  requireCoachAdmin(currentUser);
  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const skip = (page - 1) * limit;

  const where = {};
  if (currentUser.role !== 'SUPER_ADMIN') where.schedule = { department: { type: 'VANGUARD_COACH' } };
  if (query.scheduleId) where.scheduleId = query.scheduleId;
  if (query.status) where.status = query.status;

  const [items, total] = await Promise.all([
    prisma.trip.findMany({ where, skip, take: limit, orderBy: { departureAt: 'desc' } }),
    prisma.trip.count({ where }),
  ]);

  return { items, page, limit, total };
};

const getTripById = async (id, currentUser) => {
  requireCoachAdmin(currentUser);
  const trip = await prisma.trip.findUnique({ where: { id }, include: { schedule: true } });
  if (!trip) throw new AppError('Trip not found', 404);
  await assertDepartmentIdForUser(currentUser, trip.schedule.departmentId, 'VANGUARD_COACH');
  return { trip };
};

const createTrip = async (data, currentUser) => {
  requireCoachAdmin(currentUser);
  const scheduleId = typeof data?.scheduleId === 'string' ? data.scheduleId : null;
  const departureAt = data?.departureAt ? new Date(data.departureAt) : null;
  const arrivalAt = data?.arrivalAt ? new Date(data.arrivalAt) : null;

  if (!scheduleId || !departureAt || !arrivalAt) throw new AppError('scheduleId, departureAt and arrivalAt are required', 400);

  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) throw new AppError('Schedule not found', 404);
  await assertDepartmentIdForUser(currentUser, schedule.departmentId, 'VANGUARD_COACH');

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
