const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const assertEntityReference = async (entityType, entityId) => {
  if (!entityType || !entityId) return;
  const normalizedType = entityType.trim();
  const normalizedId = entityId.trim();

  if (normalizedType.toUpperCase() === 'PROJECT') {
    const project = await prisma.project.findUnique({ where: { id: normalizedId } });
    if (!project) {
      throw new AppError('Project entity not found', 404);
    }
  }

  if (normalizedType.toLowerCase() === 'vehicle') {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: normalizedId } });
    if (!vehicle) {
      throw new AppError('Vehicle entity not found', 404);
    }
  }
};

const createMedia = async (data, currentUser) => {
  const entityType = normalizeString(data.entityType);
  const entityId = normalizeString(data.entityId);

  await assertEntityReference(entityType, entityId);

  const media = await prisma.media.create({
    data: {
      fileName: normalizeString(data.fileName),
      originalName: normalizeString(data.originalName),
      mimeType: normalizeString(data.mimeType),
      size: Number(data.size),
      url: normalizeString(data.url),
      entityType,
      entityId,
      uploadedById: currentUser.id,
    },
  });
  return { media };
};

module.exports = { createMedia };
