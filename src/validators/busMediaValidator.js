const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const isValidUrl = (value) => /^https?:\/\/[\w\-@:%._+~#=\/]+$/i.test(value) || (typeof value === 'string' && value.startsWith('/uploads/'));
const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) >= 0;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'];

const validateBusMediaCreate = (req, res, next) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ success: false, message: 'Request body is required' });
  }

  const busId = normalizeString(body.busId);
  const fileName = normalizeString(body.fileName);
  const originalName = normalizeString(body.originalName);
  const mimeType = normalizeString(body.mimeType).toLowerCase();
  const url = normalizeString(body.url);
  const size = body.size;

  if (!busId) {
    return res.status(400).json({ success: false, message: 'busId is required' });
  }
  if (!fileName) {
    return res.status(400).json({ success: false, message: 'fileName is required' });
  }
  if (!originalName) {
    return res.status(400).json({ success: false, message: 'originalName is required' });
  }
  if (!mimeType) {
    return res.status(400).json({ success: false, message: 'mimeType is required' });
  }
  if (size === undefined || size === null || !Number.isFinite(Number(size)) || Number(size) <= 0) {
    return res.status(400).json({ success: false, message: 'size is required and must be a positive number' });
  }
  if (!url) {
    return res.status(400).json({ success: false, message: 'url is required' });
  }
  if (!isValidUrl(url)) {
    return res.status(400).json({ success: false, message: 'url must be a valid URL or upload path' });
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return res.status(400).json({ success: false, message: 'mimeType is not supported' });
  }

  return next();
};

const validateBusMediaUpdate = (req, res, next) => {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ success: false, message: 'At least one field must be provided for update' });
  }

  const allowedFields = ['caption', 'order', 'isPrimary', 'fileName', 'originalName', 'mimeType', 'size', 'url'];
  const hasValidField = allowedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));

  if (!hasValidField) {
    return res.status(400).json({ success: false, message: 'No valid update fields provided' });
  }

  if (body.order !== undefined && !isPositiveInteger(body.order)) {
    return res.status(400).json({ success: false, message: 'order must be a non-negative integer' });
  }
  if (body.size !== undefined && (!Number.isFinite(Number(body.size)) || Number(body.size) <= 0)) {
    return res.status(400).json({ success: false, message: 'size must be a positive number' });
  }
  if (body.url !== undefined && !isValidUrl(normalizeString(body.url))) {
    return res.status(400).json({ success: false, message: 'url must be a valid URL or upload path' });
  }
  if (body.mimeType !== undefined && !ALLOWED_MIME_TYPES.includes(normalizeString(body.mimeType).toLowerCase())) {
    return res.status(400).json({ success: false, message: 'mimeType is not supported' });
  }

  return next();
};

module.exports = {
  validateBusMediaCreate,
  validateBusMediaUpdate,
};
