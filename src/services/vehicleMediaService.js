const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const vehicleRepository = require('../repositories/vehicleRepository');
const vehicleMediaRepository = require('../repositories/vehicleMediaRepository');
const { assertDepartmentIdForUser } = require('./departmentAccessService');

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
  await assertDepartmentIdForUser(currentUser, vehicle.departmentId, 'AUTO_SALES');

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
  await assertDepartmentIdForUser(currentUser, record.vehicle.departmentId, 'AUTO_SALES');

  return { vehicleMedia: record };
};

const createVehicleMedia = async (data, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('MANAGE_VEHICLE_MEDIA')) throw new AppError('Insufficient permissions', 403);

  const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId : null;
  const caption = data?.caption ? String(data.caption).trim() : null;
  const order = data?.order !== undefined ? Number(data.order) : 0;
  const isPrimary = data?.isPrimary === true;
  const fileName = typeof data?.fileName === 'string' ? data.fileName.trim() : '';
  const originalName = typeof data?.originalName === 'string' ? data.originalName.trim() : '';
  const mimeType = typeof data?.mimeType === 'string' ? data.mimeType.trim() : '';
  const url = typeof data?.url === 'string' ? data.url.trim() : '';
  const size = Number.isFinite(Number(data?.size)) ? Number(data.size) : null;

  if (!vehicleId || !fileName || !originalName || !mimeType || !url || size === null) {
    throw new AppError('vehicleId, fileName, originalName, mimeType, size and url are required', 400);
  }
  if (size <= 0) {
    throw new AppError('size must be a positive number', 400);
  }
  if (!/^https?:\/\/.+/i.test(url)) {
    throw new AppError('url must be a valid absolute URL', 400);
  }
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];
  if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
    throw new AppError('mimeType is not supported', 400);
  }

  const vehicle = await vehicleRepository.getVehicleById(vehicleId);
  if (!vehicle) {
    throw new AppError('Vehicle not found', 404);
  }
  await assertDepartmentIdForUser(currentUser, vehicle.departmentId, 'AUTO_SALES');

  if (isPrimary) {
    await vehicleMediaRepository.unsetPrimaryForVehicle(vehicleId);
  }

  const vehicleMedia = await vehicleMediaRepository.createVehicleMedia({
    vehicleId,
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
  await assertDepartmentIdForUser(currentUser, existing.vehicle.departmentId, 'AUTO_SALES');

  const updatePayload = {};
  if (data?.caption !== undefined) updatePayload.caption = data.caption ? String(data.caption).trim() : null;
  if (data?.order !== undefined) updatePayload.order = Number.isFinite(Number(data.order)) ? Number(data.order) : existing.order;
  if (data?.isPrimary !== undefined) updatePayload.isPrimary = data.isPrimary === true;

  if (data?.isPrimary === true) {
    await vehicleMediaRepository.unsetPrimaryForVehicle(existing.vehicleId);
    await auditService.log('vehicle_media_primary_changed', currentUser.id, { vehicleId: existing.vehicleId, vehicleMediaId: id });
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
    throw new AppError('url must be a valid absolute URL', 400);
  }
  if (mediaUpdate.mimeType !== undefined) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];
    if (!allowedMimeTypes.includes(mediaUpdate.mimeType.toLowerCase())) {
      throw new AppError('mimeType is not supported', 400);
    }
  }

  const updateData = { ...updatePayload };
  if (Object.keys(mediaUpdate).length > 0) {
    updateData.media = { update: mediaUpdate };
  }

  const vehicleMedia = await vehicleMediaRepository.updateVehicleMedia(id, updateData);

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
  await assertDepartmentIdForUser(currentUser, existing.vehicle.departmentId, 'AUTO_SALES');

  await vehicleMediaRepository.deleteVehicleMedia(id);

  await auditService.log('delete_vehicle_media', currentUser.id, {
    targetVehicleId: existing.vehicleId,
    vehicleMediaId: id,
    mediaId: existing.mediaId,
  });

  return { success: true };
};

module.exports = {
  listVehicleMedia,
  getVehicleMediaById,
  createVehicleMedia,
  updateVehicleMedia,
  deleteVehicleMedia,
};
