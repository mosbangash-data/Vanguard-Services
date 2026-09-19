const { AppError } = require('../middleware/errorHandler');
const prisma = require('../config/prisma');
const auditService = require('./auditService');
const busMediaRepository = require('../repositories/busMediaRepository');
const { requireCoachAdmin, assertDepartmentIdForUser } = require('./departmentAccessService');
const { deleteMediaIfOrphaned } = require('./mediaService');

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
  const order = data?.order !== undefined ? Number(data.order) : 0;
  const isPrimary = data?.isPrimary === true;
  const fileName = typeof data?.fileName === 'string' ? data.fileName.trim() : '';
  const originalName = typeof data?.originalName === 'string' ? data.originalName.trim() : '';
  const mimeType = typeof data?.mimeType === 'string' ? data.mimeType.trim() : '';
  const url = typeof data?.url === 'string' ? data.url.trim() : '';
  const size = Number.isFinite(Number(data?.size)) ? Number(data.size) : null;

  const mediaId = typeof data?.mediaId === 'string' ? data.mediaId.trim() : null;

  if (!busId) {
    throw new AppError('busId is required', 400);
  }
  if (!mediaId && (!fileName || !originalName || !mimeType || !url || size === null)) {
    throw new AppError('busId, fileName, originalName, mimeType, size and url are required', 400);
  }
  if (!mediaId && size <= 0) {
    throw new AppError('size must be a positive number', 400);
  }
  if (!mediaId && !/^https?:\/\/.+/i.test(url)) {
    throw new AppError('url must be a valid Cloudinary URL', 400);
  }
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!mediaId && !allowedMimeTypes.includes(mimeType.toLowerCase())) {
    throw new AppError('mimeType is not supported', 400);
  }

  const bus = await prisma.bus.findUnique({ where: { id: busId } });
  if (!bus) {
    throw new AppError('Bus not found', 404);
  }
  await assertDepartmentIdForUser(currentUser, bus.departmentId, 'VANGUARD_COACH');
  if (mediaId) await requireMediaForBus(mediaId, busId, 'VANGUARD_COACH');

  if (isPrimary) {
    await busMediaRepository.unsetPrimaryForBus(busId);
  }

  const busMedia = await busMediaRepository.createBusMedia({
    busId,
    mediaId,
    caption,
    order,
    isPrimary,
    mediaData: {
      fileName,
      originalName,
      mimeType,
      size,
      url,
      uploadedById: currentUser.id,
    },
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
  if (data?.order !== undefined) updatePayload.order = Number.isFinite(Number(data.order)) ? Number(data.order) : existing.order;
  if (data?.isPrimary !== undefined) updatePayload.isPrimary = data.isPrimary === true;

  if (data?.isPrimary === true) {
    await busMediaRepository.unsetPrimaryForBus(existing.busId);
    await auditService.log('bus_media_primary_changed', currentUser.id, { busId: existing.busId, busMediaId: id });
  }

  const mediaUpdate = {};
  if (data?.fileName !== undefined) mediaUpdate.fileName = String(data.fileName).trim();
  if (data?.originalName !== undefined) mediaUpdate.originalName = String(data.originalName).trim();
  if (data?.mimeType !== undefined) mediaUpdate.mimeType = String(data.mimeType).trim();
  if (data?.url !== undefined) mediaUpdate.url = String(data.url).trim();
  if (data?.size !== undefined) mediaUpdate.size = Number.isFinite(Number(data.size)) ? Number(data.size) : existing.media.size;

  if (mediaUpdate.size !== undefined && mediaUpdate.size <= 0) {
    throw new AppError('size must be a positive number', 400);
  }
  if (mediaUpdate.url !== undefined && !/^https?:\/\//i.test(mediaUpdate.url)) {
    throw new AppError('url must be a valid Cloudinary URL', 400);
  }
  if (mediaUpdate.mimeType !== undefined) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(mediaUpdate.mimeType.toLowerCase())) {
      throw new AppError('mimeType is not supported', 400);
    }
  }

  const updateData = { ...updatePayload };
  if (Object.keys(mediaUpdate).length > 0) {
    updateData.media = { update: mediaUpdate };
  }

  const busMedia = await busMediaRepository.updateBusMedia(id, updateData);

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

  await busMediaRepository.deleteBusMedia(id);
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
