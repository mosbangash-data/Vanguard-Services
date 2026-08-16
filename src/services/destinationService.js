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

const listDestinations = async (query = {}, currentUser) => {
  requireCoachAdmin(currentUser);
  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const skip = (page - 1) * limit;

  const where = {};
  const departmentId = await getScopedDepartmentId(currentUser, query.departmentId, 'VANGUARD_COACH');
  if (departmentId) where.departmentId = departmentId;
  if (query.search) {
    const s = typeof query.search === 'string' ? query.search.trim() : '';
    if (s) where.OR = [ { departureCity: { contains: s, mode: 'insensitive' } }, { arrivalCity: { contains: s, mode: 'insensitive' } }, { code: { contains: s, mode: 'insensitive' } } ];
  }

  const [items, total] = await Promise.all([
    prisma.route.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.route.count({ where }),
  ]);

  return { items, page, limit, total };
};

const getDestinationById = async (id, currentUser) => {
  requireCoachAdmin(currentUser);
  const route = await prisma.route.findUnique({ where: { id } });
  if (!route) throw new AppError('Destination not found', 404);
  await assertDepartmentIdForUser(currentUser, route.departmentId, 'VANGUARD_COACH');
  return { route };
};

const createDestination = async (data, currentUser) => {
  requireCoachAdmin(currentUser);
  const departmentId = await getScopedDepartmentId(currentUser, typeof data?.departmentId === 'string' ? data.departmentId : null, 'VANGUARD_COACH');
  const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
  const departureCity = typeof data?.departureCity === 'string' ? data.departureCity.trim() : '';
  const arrivalCity = typeof data?.arrivalCity === 'string' ? data.arrivalCity.trim() : '';

  if (!departmentId || !code || !departureCity || !arrivalCity) throw new AppError('departmentId, code, departureCity and arrivalCity are required', 400);

  const existing = await prisma.route.findUnique({ where: { code } });
  if (existing) throw new AppError('Route code already exists', 409);

  const route = await prisma.route.create({ data: { departmentId, code, departureCity, arrivalCity, distanceKm: data.distanceKm || null, durationHours: data.durationHours || null, description: data.description || null } });
  await auditService.log('create_destination', currentUser.id, { targetRouteId: route.id });
  return { route };
};

const updateDestination = async (id, data, currentUser) => {
  requireCoachAdmin(currentUser);
  const route = await prisma.route.findUnique({ where: { id } });
  if (!route) throw new AppError('Destination not found', 404);
  await assertDepartmentIdForUser(currentUser, route.departmentId, 'VANGUARD_COACH');

  const updatePayload = {};
  if (data?.departureCity !== undefined) updatePayload.departureCity = typeof data.departureCity === 'string' ? data.departureCity.trim() : route.departureCity;
  if (data?.arrivalCity !== undefined) updatePayload.arrivalCity = typeof data.arrivalCity === 'string' ? data.arrivalCity.trim() : route.arrivalCity;
  if (data?.distanceKm !== undefined) updatePayload.distanceKm = Number.isFinite(Number(data.distanceKm)) ? Number(data.distanceKm) : route.distanceKm;
  if (data?.durationHours !== undefined) updatePayload.durationHours = Number.isFinite(Number(data.durationHours)) ? Number(data.durationHours) : route.durationHours;
  if (data?.description !== undefined) updatePayload.description = typeof data.description === 'string' && data.description.trim() ? data.description.trim() : null;

  const updated = await prisma.route.update({ where: { id }, data: updatePayload });
  await auditService.log('update_destination', currentUser.id, { targetRouteId: id });
  return { route: updated };
};

const deleteDestination = async (id, currentUser) => {
  requireCoachAdmin(currentUser);
  const route = await prisma.route.findUnique({ where: { id } });
  if (!route) throw new AppError('Destination not found', 404);
  await assertDepartmentIdForUser(currentUser, route.departmentId, 'VANGUARD_COACH');

  await prisma.route.delete({ where: { id } });
  await auditService.log('delete_destination', currentUser.id, { targetRouteId: id });
  return { success: true };
};

module.exports = { listDestinations, getDestinationById, createDestination, updateDestination, deleteDestination };
