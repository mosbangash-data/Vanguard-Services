const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { uploadMedia, destroyMedia, buildCloudinaryFolder, sanitizeDepartment } = require('./cloudinaryService');

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

const resolveDepartment = async ({ department, entityType, entityId }) => {
  if (department) {
    return sanitizeDepartment(department);
  }

  if (entityType === 'vehicle' && entityId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: entityId },
      include: { department: true },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found', 404);
    }

    return sanitizeDepartment(vehicle.department.type);
  }

  return 'AUTO_SALES';
};

const uploadAndLinkFiles = async ({ files, department, entityType = 'general', entityId, uploadedById, isPrimary = false, order = 0 }) => {
  const safeFiles = ensureValidFiles(files);
  const resolvedDepartment = await resolveDepartment({ department, entityType, entityId });
  const actualEntityId = entityId || 'generic';
  const uploadedPublicIds = [];
  const createdMedia = [];

  try {
    for (const [index, file] of safeFiles.entries()) {
      const uploadResult = await uploadMedia(file, {
        department: resolvedDepartment,
        entityType,
        entityId: actualEntityId,
      });

      uploadedPublicIds.push(uploadResult.publicId);

      const media = await prisma.media.create({
        data: {
          fileName: uploadResult.fileName || file.originalname,
          originalName: uploadResult.originalName || file.originalname,
          mimeType: uploadResult.mimeType || file.mimetype,
          size: Number(uploadResult.size || file.size || 0),
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          resourceType: uploadResult.resourceType || 'image',
          entityType,
          entityId: actualEntityId,
          department: resolvedDepartment,
          uploadedById,
        },
      });

      createdMedia.push(media);
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

module.exports = {
  MAX_FILES,
  uploadAndLinkFiles,
  uploadVehicleMedia,
  resolveDepartment,
};
