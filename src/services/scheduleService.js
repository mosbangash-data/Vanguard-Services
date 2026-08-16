const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { requireCoachAdmin, getScopedDepartmentId, assertDepartmentIdForUser } = require('./departmentAccessService');

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

const listSchedules = async (query = {}, currentUser) => {
  requireCoachAdmin(currentUser);
  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const skip = (page - 1) * limit;

  const where = {};
  const departmentId = await getScopedDepartmentId(currentUser, query.departmentId, 'VANGUARD_COACH');
  if (departmentId) where.departmentId = departmentId;
  if (query.routeId) where.routeId = query.routeId;
  if (query.busId) where.busId = query.busId;

  const [items, total] = await Promise.all([
    prisma.schedule.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.schedule.count({ where }),
  ]);

  return { items, page, limit, total };
};

const getScheduleById = async (id, currentUser) => {
  requireCoachAdmin(currentUser);
  const schedule = await prisma.schedule.findUnique({ where: { id } });
  if (!schedule) throw new AppError('Schedule not found', 404);
  await assertDepartmentIdForUser(currentUser, schedule.departmentId, 'VANGUARD_COACH');
  return { schedule };
};

const createSchedule = async (data, currentUser) => {
  requireCoachAdmin(currentUser);
  const departmentId = await getScopedDepartmentId(currentUser, typeof data?.departmentId === 'string' ? data.departmentId : null, 'VANGUARD_COACH');
  const routeId = typeof data?.routeId === 'string' ? data.routeId : null;
  const busId = typeof data?.busId === 'string' ? data.busId : null;
  const departureTime = typeof data?.departureTime === 'string' ? data.departureTime.trim() : '';
  const availableDays = Array.isArray(data?.availableDays) ? data.availableDays : [];
  const price = data?.price !== undefined ? data.price : null;

  if (!departmentId || !routeId || !busId || !departureTime || availableDays.length === 0 || price === null) throw new AppError('departmentId, routeId, busId, departureTime, availableDays and price are required', 400);

  const route = await prisma.route.findUnique({ where: { id: routeId } });
  if (!route) throw new AppError('Route not found', 404);
  const bus = await prisma.bus.findUnique({ where: { id: busId } });
  if (!bus) throw new AppError('Bus not found', 404);
  if (route.departmentId !== departmentId || bus.departmentId !== departmentId) throw new AppError('Route and bus must belong to the selected department', 400);

  const schedule = await prisma.schedule.create({ data: { departmentId, routeId, busId, departureTime, returnTime: data.returnTime || null, availableDays, price: price.toString() } });
  await auditService.log('create_schedule', currentUser.id, { targetScheduleId: schedule.id });
  return { schedule };
};

const updateSchedule = async (id, data, currentUser) => {
  requireCoachAdmin(currentUser);
  const schedule = await prisma.schedule.findUnique({ where: { id } });
  if (!schedule) throw new AppError('Schedule not found', 404);
  await assertDepartmentIdForUser(currentUser, schedule.departmentId, 'VANGUARD_COACH');

  const updatePayload = {};
  if (data?.departureTime !== undefined) updatePayload.departureTime = typeof data.departureTime === 'string' ? data.departureTime.trim() : schedule.departureTime;
  if (data?.returnTime !== undefined) updatePayload.returnTime = typeof data.returnTime === 'string' ? data.returnTime.trim() : schedule.returnTime;
  if (data?.availableDays !== undefined) updatePayload.availableDays = Array.isArray(data.availableDays) ? data.availableDays : schedule.availableDays;
  if (data?.price !== undefined) updatePayload.price = data.price.toString();
  if (data?.status !== undefined) updatePayload.status = data.status;

  const updated = await prisma.schedule.update({ where: { id }, data: updatePayload });
  await auditService.log('update_schedule', currentUser.id, { targetScheduleId: id });
  return { schedule: updated };
};

const deleteSchedule = async (id, currentUser) => {
  requireCoachAdmin(currentUser);
  const schedule = await prisma.schedule.findUnique({ where: { id } });
  if (!schedule) throw new AppError('Schedule not found', 404);
  await assertDepartmentIdForUser(currentUser, schedule.departmentId, 'VANGUARD_COACH');

  await prisma.schedule.delete({ where: { id } });
  await auditService.log('delete_schedule', currentUser.id, { targetScheduleId: id });
  return { success: true };
};

module.exports = { listSchedules, getScheduleById, createSchedule, updateSchedule, deleteSchedule };
