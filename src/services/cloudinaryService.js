const cloudinary = require('cloudinary').v2;
const { AppError } = require('../middleware/errorHandler');
const env = require('../config/env');

const VALID_DEPARTMENTS = new Set([
  'GENERAL',
  'AUTO_SALES',
  'VANGUARD_COACH',
  'CONSTRUCTION',
]);

const { SUPPORTED_ENTITY_TYPES } = require('../config/media');

const normalizeDepartment = (value) => {
  if (!value || typeof value !== 'string') {
    throw new AppError('Department is required', 400);
  }

  const normalized = String(value).trim().toUpperCase();
  if (!VALID_DEPARTMENTS.has(normalized)) {
    throw new AppError(`Department is not valid for Cloudinary folder generation: ${value}`, 400);
  }

  return normalized;
};

const sanitizeDepartment = (value) => normalizeDepartment(value);

const normalizeEntityType = (value) => {
  const normalized = String(value || 'general').trim().toLowerCase();
  if (!SUPPORTED_ENTITY_TYPES.has(normalized)) {
    throw new AppError(`Unsupported entityType for media upload: ${value}`, 400);
  }
  return normalized;
};

const buildCloudinaryFolder = ({ department, entityType, entityId }) => {
  const normalizedDepartment = normalizeDepartment(department);
  const normalizedEntityType = normalizeEntityType(entityType);
  const normalizedEntityId = String(entityId || 'generic').trim();

  if (!normalizedEntityId) {
    throw new AppError('entityId is required to build the Cloudinary folder', 400);
  }

  const entityFolderMap = {
    vehicle: 'vehicles',
    bus: 'buses',
    project: 'projects',
    general: 'general',
  };

  return `vanguard-services/${normalizedDepartment}/${entityFolderMap[normalizedEntityType]}/${normalizedEntityId}`;
};

const hasCloudinaryConfig = () => Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);

const getCloudinaryClient = () => {
  if (!hasCloudinaryConfig()) {
    throw new AppError('Cloudinary configuration is missing. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.', 500);
  }

  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });

  return cloudinary;
};

const getOptimizedUrl = (publicId, options = {}) => {
  if (!publicId) return '';
  const client = getCloudinaryClient();
  return client.url(publicId, {
    secure: true,
    fetch_format: 'auto',
    quality: 'auto',
    ...options,
  });
};

const uploadMedia = async (file, { department, entityType, entityId, resourceType = 'image' } = {}) => {
  if (!file || !file.buffer) {
    throw new AppError('A valid file buffer is required for upload', 400);
  }

  const client = getCloudinaryClient();
  const resolvedFolder = buildCloudinaryFolder({ department, entityType, entityId });
  const uploadOptions = {
    folder: resolvedFolder,
    resource_type: resourceType,
    overwrite: false,
    unique_filename: true,
    use_filename: false,
    eager: [{ fetch_format: 'auto', quality: 'auto', width: 1200, height: 900, crop: 'limit' }],
  };

  const result = await client.uploader.upload(`data:${file.mimetype};base64,${file.buffer.toString('base64')}`, uploadOptions);

  return {
    publicId: result.public_id,
    url: result.secure_url,
    secureUrl: result.secure_url,
    resourceType: result.resource_type || resourceType,
    format: result.format || null,
    width: result.width || null,
    height: result.height || null,
    fileName: file.originalname || file.filename || result.original_filename,
    originalName: file.originalname || file.filename || result.original_filename,
    mimeType: file.mimetype || result.format,
    size: result.bytes || file.size || 0,
    folder: resolvedFolder,
  };
};

const destroyMedia = async (publicId, { resourceType = 'image' } = {}) => {
  if (!publicId) return { result: 'noop' };
  const client = getCloudinaryClient();
  const result = await client.uploader.destroy(publicId, { resource_type: resourceType });
  return result;
};

const extractPublicIdFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const uploadIndex = pathParts.findIndex((part) => part === 'upload');
    if (uploadIndex === -1 || uploadIndex + 1 >= pathParts.length) return null;
    const remainder = pathParts.slice(uploadIndex + 1);
    const withoutVersion = remainder.filter((part) => !/^v\d+$/.test(part));
    return withoutVersion.join('/').replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
};

module.exports = {
  VALID_DEPARTMENTS,
  buildCloudinaryFolder,
  sanitizeDepartment,
  uploadMedia,
  destroyMedia,
  getOptimizedUrl,
  extractPublicIdFromUrl,
  hasCloudinaryConfig,
};
