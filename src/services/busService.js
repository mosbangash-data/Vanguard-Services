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

const listBuses = async (query = {}, currentUser) => {
  requireCoachAdmin(currentUser);

  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const skip = (page - 1) * limit;

  const where = {};
  const departmentId = await getScopedDepartmentId(currentUser, query.departmentId, 'VANGUARD_COACH');
  if (departmentId) where.departmentId = departmentId;
  if (query.search) {
    const s = typeof query.search === 'string' ? query.search.trim() : '';
    if (s) where.OR = [ { plateNumber: { contains: s, mode: 'insensitive' } }, { brand: { contains: s, mode: 'insensitive' } }, { model: { contains: s, mode: 'insensitive' } } ];
  }

  const [items, total] = await Promise.all([
    prisma.bus.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.bus.count({ where }),
  ]);

  return { items, page, limit, total };
};

const getBusById = async (busId, currentUser) => {
  requireCoachAdmin(currentUser);
  const bus = await prisma.bus.findUnique({ where: { id: busId } });
  if (!bus) throw new AppError('Bus not found', 404);
  await assertDepartmentIdForUser(currentUser, bus.departmentId, 'VANGUARD_COACH');
  return { bus };
};

const createBus = async (data, currentUser) => {
  requireCoachAdmin(currentUser);
  const departmentId = await getScopedDepartmentId(currentUser, typeof data?.departmentId === 'string' ? data.departmentId : null, 'VANGUARD_COACH');
  const plateNumber = typeof data?.plateNumber === 'string' ? data.plateNumber.trim().toUpperCase() : '';
  const brand = typeof data?.brand === 'string' ? data.brand.trim() : '';
  const model = typeof data?.model === 'string' ? data.model.trim() : '';
  const seats = Number.isFinite(Number(data?.seats)) ? Number(data.seats) : null;

  if (!departmentId || !plateNumber || !brand || !model || !seats) throw new AppError('departmentId, plateNumber, brand, model and seats are required', 400);

  const existing = await prisma.bus.findUnique({ where: { plateNumber } });
  if (existing) throw new AppError('Bus with this plate number already exists', 409);

  const bus = await prisma.bus.create({ data: { departmentId, plateNumber, brand, model, seats } });
  await auditService.log('create_bus', currentUser.id, { targetBusId: bus.id });
  return { bus };
};

const updateBus = async (busId, data, currentUser) => {
  requireCoachAdmin(currentUser);
  const bus = await prisma.bus.findUnique({ where: { id: busId } });
  if (!bus) throw new AppError('Bus not found', 404);
  await assertDepartmentIdForUser(currentUser, bus.departmentId, 'VANGUARD_COACH');

  const updatePayload = {};
  if (data?.brand !== undefined) updatePayload.brand = typeof data.brand === 'string' ? data.brand.trim() : bus.brand;
  if (data?.model !== undefined) updatePayload.model = typeof data.model === 'string' ? data.model.trim() : bus.model;
  if (data?.seats !== undefined) updatePayload.seats = Number.isFinite(Number(data.seats)) ? Number(data.seats) : bus.seats;
  if (data?.status !== undefined) updatePayload.status = data.status;

  const updated = await prisma.bus.update({ where: { id: busId }, data: updatePayload });
  await auditService.log('update_bus', currentUser.id, { targetBusId: busId });
  return { bus: updated };
};

const deleteBus = async (busId, currentUser) => {
  requireCoachAdmin(currentUser);
  const bus = await prisma.bus.findUnique({ where: { id: busId } });
  if (!bus) throw new AppError('Bus not found', 404);
  await assertDepartmentIdForUser(currentUser, bus.departmentId, 'VANGUARD_COACH');

  await prisma.bus.delete({ where: { id: busId } });
  await auditService.log('delete_bus', currentUser.id, { targetBusId: busId });
  return { success: true };
};

module.exports = { listBuses, getBusById, createBus, updateBus, deleteBus };
