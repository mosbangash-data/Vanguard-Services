const { AppError } = require('../middleware/errorHandler');
const prisma = require('../config/prisma');
const auditService = require('./auditService');
const busMediaRepository = require('../repositories/busMediaRepository');
const { requireCoachAdmin, assertDepartmentIdForUser } = require('./departmentAccessService');
const { deleteMediaIfOrphaned } = require('./mediaService');

const normalizeOrder = (value, fallback = 0) => {
  if (value === undefined) return fallback;
  if (value === null || value === '') {
    throw new AppError('order must be a non-negative integer', 400);
  }
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 0) {
    throw new AppError('order must be a non-negative integer', 400);
  }
  return normalized;
};

const requireMediaForBus = async (mediaId, busId, departmentType) => {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media || media.entityType !== 'bus' || media.entityId !== busId || media.department !== departmentType) {
    throw new AppError('Media is not valid for this bus', 403);
  }
  return media;
};

const listBusMedia = async (busId, currentUser) => {
  requireCoachAdmin(currentUser);
  if (!busId) {
    throw new AppError('busId is required', 400);
  }

  const bus = await prisma.bus.findUnique({ where: { id: busId } });
  if (!bus) {
    throw new AppError('Bus not found', 404);
  }
  await assertDepartmentIdForUser(currentUser, bus.departmentId, 'VANGUARD_COACH');

  const items = await busMediaRepository.listMediaByBusId(busId);
  return { items };
};

const getBusMediaById = async (id, currentUser) => {
  requireCoachAdmin(currentUser);

  const record = await busMediaRepository.getBusMediaById(id);
  if (!record) {
    throw new AppError('Bus media not found', 404);
  }
  await assertDepartmentIdForUser(currentUser, record.bus.departmentId, 'VANGUARD_COACH');

  return { busMedia: record };
};

const createBusMedia = async (data, currentUser) => {
  requireCoachAdmin(currentUser);

  const busId = typeof data?.busId === 'string' ? data.busId : null;
  const caption = data?.caption ? String(data.caption).trim() : null;
  const order = normalizeOrder(data?.order);
  const isPrimary = data?.isPrimary === true;
  const mediaId = typeof data?.mediaId === 'string' ? data.mediaId.trim() : null;

  if (!busId) {
    throw new AppError('busId is required', 400);
  }
  if (!mediaId) throw new AppError('mediaId is required. Upload the file through /api/upload first.', 400);

  const bus = await prisma.bus.findUnique({ where: { id: busId } });
  if (!bus) {
    throw new AppError('Bus not found', 404);
  }
  await assertDepartmentIdForUser(currentUser, bus.departmentId, 'VANGUARD_COACH');
  if (mediaId) await requireMediaForBus(mediaId, busId, 'VANGUARD_COACH');

  const busMedia = await prisma.$transaction(async (tx) => {
    if (isPrimary) await busMediaRepository.unsetPrimaryForBus(busId, tx);
    return busMediaRepository.createBusMedia({ busId, mediaId, caption, order, isPrimary }, tx);
  });

  await auditService.log('create_bus_media', currentUser.id, {
    targetBusId: busId,
    busMediaId: busMedia.id,
    mediaId: busMedia.media.id,
  });

  return { busMedia };
};

const updateBusMedia = async (id, data, currentUser) => {
  requireCoachAdmin(currentUser);

  const existing = await busMediaRepository.getBusMediaById(id);
  if (!existing) {
    throw new AppError('Bus media not found', 404);
  }
  await assertDepartmentIdForUser(currentUser, existing.bus.departmentId, 'VANGUARD_COACH');

  const updatePayload = {};
  if (data?.caption !== undefined) updatePayload.caption = data.caption ? String(data.caption).trim() : null;
  if (data?.order !== undefined) updatePayload.order = normalizeOrder(data.order, existing.order);
  if (data?.isPrimary !== undefined) updatePayload.isPrimary = data.isPrimary === true;

  const busMedia = await prisma.$transaction(async (tx) => {
    if (data?.isPrimary === true) await busMediaRepository.unsetPrimaryForBus(existing.busId, tx);
    return busMediaRepository.updateBusMedia(id, updatePayload, tx);
  });

  if (data?.isPrimary === true) {
    await auditService.log('bus_media_primary_changed', currentUser.id, { busId: existing.busId, busMediaId: id });
  }

  await auditService.log('update_bus_media', currentUser.id, {
    targetBusId: existing.busId,
    busMediaId: busMedia.id,
    mediaId: busMedia.media.id,
  });

  return { busMedia };
};

const deleteBusMedia = async (id, currentUser) => {
  requireCoachAdmin(currentUser);

  const existing = await busMediaRepository.getBusMediaById(id);
  if (!existing) {
    throw new AppError('Bus media not found', 404);
  }
  await assertDepartmentIdForUser(currentUser, existing.bus.departmentId, 'VANGUARD_COACH');

  await prisma.$transaction(async (tx) => {
    await busMediaRepository.deleteBusMedia(id, tx);
    const remaining = await busMediaRepository.listMediaByBusId(existing.busId, tx);
    for (const [index, item] of remaining.entries()) {
      if (item.order !== index) await busMediaRepository.updateBusMedia(item.id, { order: index }, tx);
    }
  });
  await deleteMediaIfOrphaned(existing.mediaId);

  await auditService.log('delete_bus_media', currentUser.id, {
    targetBusId: existing.busId,
    busMediaId: id,
    mediaId: existing.mediaId,
  });

  return { success: true };
};

module.exports = {
  listBusMedia,
  getBusMediaById,
  createBusMedia,
  updateBusMedia,
  deleteBusMedia,
};
