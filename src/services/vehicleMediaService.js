const { AppError } = require('../middleware/errorHandler');
const prisma = require('../config/prisma');
const auditService = require('./auditService');
const vehicleRepository = require('../repositories/vehicleRepository');
const vehicleMediaRepository = require('../repositories/vehicleMediaRepository');
const { assertDepartmentScope } = require('./departmentAccessService');
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

const mediaMatchesEntity = (media, entityType, entityId, departmentType) => Boolean(
  media
  && media.entityType === entityType
  && media.entityId === entityId
  && media.department === departmentType
);

const requireMediaForEntity = async (mediaId, entityType, entityId, departmentType) => {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!mediaMatchesEntity(media, entityType, entityId, departmentType)) {
    console.warn('[vehicle-media-validation]', {
      vehicleId: entityId,
      mediaId,
      mediaExists: Boolean(media),
      mediaEntityType: media?.entityType ?? null,
      mediaEntityId: media?.entityId ?? null,
      mediaDepartment: media?.department ?? null,
      expectedEntityType: entityType,
      expectedEntityId: entityId,
      expectedDepartment: departmentType,
    });
    throw new AppError('Media is not valid for this entity', 403);
  }
  return media;
};

const assertAutoSalesAccess = (currentUser) => {
  if (!currentUser) {
    throw new AppError('Unauthorized', 401);
  }

  if (currentUser.role !== 'SUPER_ADMIN' && currentUser.department?.type !== 'AUTO_SALES') {
    throw new AppError('Access denied', 403);
  }
};

const listVehicleMedia = async (vehicleId, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_VEHICLE_MEDIA')) throw new AppError('Insufficient permissions', 403);

  if (!vehicleId) {
    throw new AppError('vehicleId is required', 400);
  }

  const vehicle = await vehicleRepository.getVehicleById(vehicleId);
  if (!vehicle) {
    throw new AppError('Vehicle not found', 404);
  }
  await assertDepartmentScope(currentUser, vehicle.departmentId, 'AUTO_SALES');

  const items = await vehicleMediaRepository.listMediaByVehicleId(vehicleId);
  return { items };
};

const getVehicleMediaById = async (id, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_VEHICLE_MEDIA')) throw new AppError('Insufficient permissions', 403);

  const record = await vehicleMediaRepository.getVehicleMediaById(id);
  if (!record) {
    throw new AppError('Vehicle media not found', 404);
  }
  await assertDepartmentScope(currentUser, record.vehicle.departmentId, 'AUTO_SALES');

  return { vehicleMedia: record };
};

const createVehicleMedia = async (data, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_VEHICLE_MEDIA')) throw new AppError('Insufficient permissions', 403);

  const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId : null;
  const caption = data?.caption ? String(data.caption).trim() : null;
  const order = normalizeOrder(data?.order);
  const isPrimary = data?.isPrimary === true;
  const mediaId = typeof data?.mediaId === 'string' ? data.mediaId.trim() : null;

  if (!vehicleId) {
    throw new AppError('vehicleId is required', 400);
  }
  if (!mediaId) throw new AppError('mediaId is required. Upload the file through /api/upload first.', 400);

  const vehicle = await vehicleRepository.getVehicleById(vehicleId);
  if (!vehicle) {
    throw new AppError('Vehicle not found', 404);
  }
  await assertDepartmentScope(currentUser, vehicle.departmentId, 'AUTO_SALES');

  if (mediaId) {
    const media = await requireMediaForEntity(mediaId, 'vehicle', vehicleId, vehicle.department?.type);
    if (!media) throw new AppError('Media is not valid for this vehicle', 403);
  }

  const vehicleMedia = await prisma.$transaction(async (tx) => {
    if (isPrimary) await vehicleMediaRepository.unsetPrimaryForVehicle(vehicleId, tx);
    return vehicleMediaRepository.createVehicleMedia({ vehicleId, mediaId, caption, order, isPrimary }, tx);
  });

  await auditService.log('create_vehicle_media', currentUser.id, {
    targetVehicleId: vehicleId,
    vehicleMediaId: vehicleMedia.id,
    mediaId: vehicleMedia.media.id,
  });

  return { vehicleMedia };
};

const updateVehicleMedia = async (id, data, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_VEHICLE_MEDIA')) throw new AppError('Insufficient permissions', 403);

  const existing = await vehicleMediaRepository.getVehicleMediaById(id);
  if (!existing) {
    throw new AppError('Vehicle media not found', 404);
  }
  await assertDepartmentScope(currentUser, existing.vehicle.departmentId, 'AUTO_SALES');

  const updatePayload = {};
  if (data?.caption !== undefined) updatePayload.caption = data.caption ? String(data.caption).trim() : null;
  if (data?.order !== undefined) updatePayload.order = normalizeOrder(data.order, existing.order);
  if (data?.isPrimary !== undefined) updatePayload.isPrimary = data.isPrimary === true;

  const vehicleMedia = await prisma.$transaction(async (tx) => {
    if (data?.isPrimary === true) await vehicleMediaRepository.unsetPrimaryForVehicle(existing.vehicleId, tx);
    return vehicleMediaRepository.updateVehicleMedia(id, updatePayload, tx);
  });

  if (data?.isPrimary === true) {
    await auditService.log('vehicle_media_primary_changed', currentUser.id, { vehicleId: existing.vehicleId, vehicleMediaId: id });
  }

  await auditService.log('update_vehicle_media', currentUser.id, {
    targetVehicleId: existing.vehicleId,
    vehicleMediaId: vehicleMedia.id,
    mediaId: vehicleMedia.media.id,
  });

  return { vehicleMedia };
};

const deleteVehicleMedia = async (id, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_VEHICLE_MEDIA')) throw new AppError('Insufficient permissions', 403);

  const existing = await vehicleMediaRepository.getVehicleMediaById(id);
  if (!existing) {
    throw new AppError('Vehicle media not found', 404);
  }
  await assertDepartmentScope(currentUser, existing.vehicle.departmentId, 'AUTO_SALES');

  await prisma.$transaction(async (tx) => {
    await vehicleMediaRepository.deleteVehicleMedia(id, tx);
    const remaining = await vehicleMediaRepository.listMediaByVehicleId(existing.vehicleId, tx);
    for (const [index, item] of remaining.entries()) {
      if (item.order !== index) await vehicleMediaRepository.updateVehicleMedia(item.id, { order: index }, tx);
    }
  });
  await deleteMediaIfOrphaned(existing.mediaId);

  await auditService.log('delete_vehicle_media', currentUser.id, {
    targetVehicleId: existing.vehicleId,
    vehicleMediaId: id,
    mediaId: existing.mediaId,
  });

  return { success: true };
};

module.exports = {
  mediaMatchesEntity,
  listVehicleMedia,
  getVehicleMediaById,
  createVehicleMedia,
  updateVehicleMedia,
  deleteVehicleMedia,
};
