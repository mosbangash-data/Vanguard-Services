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

const listDrivers = async (query = {}, currentUser) => {
  requireCoachAdmin(currentUser);

  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const skip = (page - 1) * limit;

  const where = {};
  const departmentId = await getScopedDepartmentId(currentUser, query.departmentId, 'VANGUARD_COACH');
  if (departmentId) where.departmentId = departmentId;
  if (query.search) {
    const s = typeof query.search === 'string' ? query.search.trim() : '';
    if (s) where.OR = [ { firstName: { contains: s, mode: 'insensitive' } }, { lastName: { contains: s, mode: 'insensitive' } }, { licenseNumber: { contains: s, mode: 'insensitive' } } ];
  }

  const [items, total] = await Promise.all([
    prisma.driver.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.driver.count({ where }),
  ]);

  return { items, page, limit, total };
};

const getDriverById = async (driverId, currentUser) => {
  requireCoachAdmin(currentUser);
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new AppError('Driver not found', 404);
  await assertDepartmentIdForUser(currentUser, driver.departmentId, 'VANGUARD_COACH');
  return { driver };
};

const createDriver = async (data, currentUser) => {
  requireCoachAdmin(currentUser);
  const departmentId = await getScopedDepartmentId(currentUser, typeof data?.departmentId === 'string' ? data.departmentId : null, 'VANGUARD_COACH');
  const firstName = typeof data?.firstName === 'string' ? data.firstName.trim() : '';
  const lastName = typeof data?.lastName === 'string' ? data.lastName.trim() : '';
  const licenseNumber = typeof data?.licenseNumber === 'string' ? data.licenseNumber.trim().toUpperCase() : '';
  const phone = typeof data?.phone === 'string' ? data.phone.trim() : null;
  const email = typeof data?.email === 'string' ? data.email.trim() : null;

  if (!departmentId || !firstName || !lastName || !licenseNumber) throw new AppError('departmentId, firstName, lastName and licenseNumber are required', 400);

  const existing = await prisma.driver.findUnique({ where: { licenseNumber } });
  if (existing) throw new AppError('Driver with this license number already exists', 409);

  const driver = await prisma.driver.create({ data: { departmentId, firstName, lastName, licenseNumber, phone, email } });
  await auditService.log('create_driver', currentUser.id, { targetDriverId: driver.id });
  return { driver };
};

const updateDriver = async (driverId, data, currentUser) => {
  requireCoachAdmin(currentUser);
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new AppError('Driver not found', 404);
  await assertDepartmentIdForUser(currentUser, driver.departmentId, 'VANGUARD_COACH');

  const updatePayload = {};
  if (data?.firstName !== undefined) updatePayload.firstName = typeof data.firstName === 'string' ? data.firstName.trim() : driver.firstName;
  if (data?.lastName !== undefined) updatePayload.lastName = typeof data.lastName === 'string' ? data.lastName.trim() : driver.lastName;
  if (data?.phone !== undefined) updatePayload.phone = typeof data.phone === 'string' ? data.phone.trim() : driver.phone;
  if (data?.email !== undefined) updatePayload.email = typeof data.email === 'string' ? data.email.trim() : driver.email;
  if (data?.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);

  const updated = await prisma.driver.update({ where: { id: driverId }, data: updatePayload });
  await auditService.log('update_driver', currentUser.id, { targetDriverId: driverId });
  return { driver: updated };
};

const deleteDriver = async (driverId, currentUser) => {
  requireCoachAdmin(currentUser);
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new AppError('Driver not found', 404);
  await assertDepartmentIdForUser(currentUser, driver.departmentId, 'VANGUARD_COACH');

  await prisma.driver.delete({ where: { id: driverId } });
  await auditService.log('delete_driver', currentUser.id, { targetDriverId: driverId });
  return { success: true };
};

module.exports = { listDrivers, getDriverById, createDriver, updateDriver, deleteDriver };
