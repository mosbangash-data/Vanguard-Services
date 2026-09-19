const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { uploadMedia, destroyMedia, sanitizeDepartment } = require('./cloudinaryService');

const MAX_FILES = 12;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const ensureValidFiles = (files) => {
  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) throw new AppError('No file uploaded', 400);
  if (list.length > MAX_FILES) throw new AppError(`A maximum of ${MAX_FILES} files can be uploaded at once`, 400);

  for (const file of list) {
    if (!file || !file.buffer || !file.originalname) {
      throw new AppError('Each uploaded file must include its binary content and original name', 400);
    }
    const mimeType = normalizeString(file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new AppError(`Unsupported file type: ${mimeType || 'unknown'}. Allowed: JPEG, PNG, WEBP, GIF`, 400);
    }
    if (file.size && Number(file.size) > 10 * 1024 * 1024) {
      throw new AppError('Each file must be 10MB or smaller', 413);
    }
  }

  return list;
};

const resolveEntityContext = async ({ department, entityType, entityId, user }) => {
  const requestedType = normalizeString(entityType).toLowerCase();
  const normalizedType = requestedType;
  if (!['vehicle', 'project', 'bus', 'general'].includes(normalizedType)) {
    throw new AppError('entityType must be one of vehicle, project, bus or general', 422);
  }

  if (normalizedType === 'general') {
    if (department && sanitizeDepartment(department) !== 'GENERAL') {
      throw new AppError('General media must use the GENERAL department', 403);
    }
    return { department: 'GENERAL', entity: null };
  }
  if (!entityId) throw new AppError('entityId is required for this entityType', 400);

  const lookup = {
    vehicle: () => prisma.vehicle.findUnique({ where: { id: entityId }, include: { department: true } }),
    project: () => prisma.project.findUnique({ where: { id: entityId }, include: { department: true } }),
    bus: () => prisma.bus.findUnique({ where: { id: entityId }, include: { department: true } }),
  };
  const entity = await lookup[normalizedType]();
  if (!entity) throw new AppError(`${normalizedType} not found`, 404);

  const resolvedDepartment = sanitizeDepartment(entity.department.type);
  if (department && sanitizeDepartment(department) !== resolvedDepartment) {
    throw new AppError('The requested department does not match the entity', 403);
  }
  if (user?.role !== 'SUPER_ADMIN' && user?.department?.type !== resolvedDepartment) {
    throw new AppError('Access denied for this department', 403);
  }
  if (user?.role !== 'SUPER_ADMIN') {
    const permissions = user?.permissions || [];
    const allowed = normalizedType === 'vehicle'
      ? permissions.includes('MANAGE_VEHICLE_MEDIA')
      : normalizedType === 'project'
      ? permissions.includes('CREATE_PROJECT') || permissions.includes('UPDATE_PROJECT')
      : user?.role === 'SERVICE_ADMIN';
    if (!allowed) throw new AppError('Insufficient permissions', 403);
  }
  return { department: resolvedDepartment, entity };
};

const uploadAndLinkFiles = async ({ files, department, entityType = 'general', entityId, uploadedById, user, isPrimary = false, order = 0 }) => {
  const safeFiles = ensureValidFiles(files);
  const canonicalEntityType = normalizeString(entityType).toLowerCase();
  const { department: resolvedDepartment } = await resolveEntityContext({ department, entityType: canonicalEntityType, entityId, user });
  const actualEntityId = entityId || 'generic';
  const uploadedPublicIds = [];
  const createdMedia = [];

  try {
    for (const [index, file] of safeFiles.entries()) {
      const uploadResult = await uploadMedia(file, {
        department: resolvedDepartment,
        entityType: canonicalEntityType,
        entityId: actualEntityId,
      });

      uploadedPublicIds.push(uploadResult.publicId);

      const mediaRecord = await prisma.media.create({
        data: {
          fileName: uploadResult.fileName || file.originalname,
          originalName: uploadResult.originalName || file.originalname,
          mimeType: uploadResult.mimeType || file.mimetype,
          size: Number(uploadResult.size || file.size || 0),
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          resourceType: uploadResult.resourceType || 'image',
          entityType: canonicalEntityType,
          entityId: actualEntityId,
          department: resolvedDepartment,
          uploadedById,
        },
      });

      createdMedia.push({
        id: mediaRecord.id,
        url: mediaRecord.url,
        secureUrl: uploadResult.secureUrl || mediaRecord.url,
        publicId: mediaRecord.publicId,
        resourceType: mediaRecord.resourceType,
        format: uploadResult.format || null,
        size: mediaRecord.size,
        width: uploadResult.width || null,
        height: uploadResult.height || null,
        fileName: mediaRecord.fileName,
        originalName: mediaRecord.originalName,
        mimeType: mediaRecord.mimeType,
        department: mediaRecord.department,
        entityType: mediaRecord.entityType,
        entityId: mediaRecord.entityId,
        uploadedById: mediaRecord.uploadedById,
      });
    }

    return {
      items: createdMedia,
      uploadedPublicIds,
      department: resolvedDepartment,
    };
  } catch (error) {
    if (uploadedPublicIds.length > 0) {
      await Promise.allSettled(uploadedPublicIds.map((publicId) => destroyMedia(publicId)));
    }
    throw error;
  }
};

const uploadVehicleMedia = async ({ vehicleId, files, user, isPrimary = false, order = 0 }) => {
  if (!vehicleId) throw new AppError('vehicleId is required', 400);
  if (!user) throw new AppError('Unauthorized', 401);

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { department: true, media: { include: { media: true } } },
  });

  if (!vehicle) throw new AppError('Vehicle not found', 404);

  const departmentType = vehicle.department?.type || 'AUTO_SALES';
  const resolvedDepartment = sanitizeDepartment(departmentType);

  const uploadResult = await uploadAndLinkFiles({
    files,
    department: resolvedDepartment,
    entityType: 'vehicle',
    entityId: vehicleId,
    uploadedById: user.id,
    user,
    isPrimary,
    order,
  });

  let primaryCandidate = isPrimary;
  if (!primaryCandidate && !vehicle.media?.some((entry) => entry.isPrimary)) {
    primaryCandidate = true;
  }

  const linked = [];
  for (let index = 0; index < uploadResult.items.length; index += 1) {
    const media = uploadResult.items[index];
    const mediaOrder = Number(order) + index;
    const shouldBePrimary = primaryCandidate && index === 0;

    const created = await prisma.vehicleMedia.create({
      data: {
        vehicleId,
        mediaId: media.id,
        caption: null,
        order: mediaOrder,
        isPrimary: shouldBePrimary,
      },
      include: { media: true },
    });

    if (shouldBePrimary) {
      await prisma.vehicleMedia.updateMany({
        where: { vehicleId, id: { not: created.id } },
        data: { isPrimary: false },
      });
    }

    linked.push(created);
  }

  return { items: linked, uploadedPublicIds: uploadResult.uploadedPublicIds };
};

const deleteMediaIfOrphaned = async (mediaId) => {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: { vehicleMedia: true, projectGallery: true, busMedia: true },
  });
  if (!media) return;
  const relationCount = media.vehicleMedia.length + media.projectGallery.length + media.busMedia.length;
  if (relationCount > 0) return;
  if (media.publicId) {
    await destroyMedia(media.publicId, { resourceType: media.resourceType || 'image' });
  }
  await prisma.media.delete({ where: { id: media.id } });
};

module.exports = {
  MAX_FILES,
  uploadAndLinkFiles,
  uploadVehicleMedia,
  deleteMediaIfOrphaned,
  resolveEntityContext,
};
