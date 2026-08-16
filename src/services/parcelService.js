const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { requireDepartmentType } = require('./departmentAccessService');

const assertParcelAccess = (currentUser) => {
  requireDepartmentType(currentUser, 'VANGUARD_COACH');
  if (!['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(currentUser.role)) {
    throw new AppError('Insufficient permissions', 403);
  }
};

const listParcels = async (query = {}, currentUser) => {
  assertParcelAccess(currentUser);
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Math.min(Number(query.limit), 100) : 20;
  const skip = (page - 1) * limit;

  const where = {};
  if (query.trackingCode) where.trackingCode = query.trackingCode;
  if (query.status) where.status = query.status;

  const [items, total] = await Promise.all([
    prisma.parcel.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.parcel.count({ where }),
  ]);
  return { items, page, limit, total };
};

const getParcelById = async (id, currentUser) => {
  assertParcelAccess(currentUser);
  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) throw new AppError('Parcel not found', 404);
  return { parcel };
};

const createParcel = async (data, currentUser) => {
  assertParcelAccess(currentUser);
  const trackingCode = data.trackingCode ?? `PKG-${Date.now()}`;
  const payload = {
    trackingCode,
    senderName: data.senderName,
    senderPhone: data.senderPhone,
    recipientName: data.recipientName,
    recipientPhone: data.recipientPhone,
    originCity: data.originCity,
    destinationCity: data.destinationCity,
    weightKg: data.weightKg ?? '0.00',
    volumeM3: data.volumeM3 ?? '0.00',
    amount: data.amount ?? '0.00'
  };
  const parcel = await prisma.parcel.create({ data: payload });
  await auditService.log('create_parcel', currentUser.id, { targetParcelId: parcel.id });
  return { parcel };
};

const updateParcel = async (id, data, currentUser) => {
  assertParcelAccess(currentUser);
  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) throw new AppError('Parcel not found', 404);
  const updated = await prisma.parcel.update({ where: { id }, data });
  await auditService.log('update_parcel', currentUser.id, { targetParcelId: id });
  return { parcel: updated };
};

const deleteParcel = async (id, currentUser) => {
  assertParcelAccess(currentUser);
  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) throw new AppError('Parcel not found', 404);
  await prisma.parcel.delete({ where: { id } });
  await auditService.log('delete_parcel', currentUser.id, { targetParcelId: id });
  return { success: true };
};

module.exports = { listParcels, getParcelById, createParcel, updateParcel, deleteParcel };
