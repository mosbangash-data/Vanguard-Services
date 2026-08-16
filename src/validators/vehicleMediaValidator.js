const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const isValidUrl = (value) => /^https?:\/\/[\w\-@:%._+~#=\/]+$/i.test(value);
const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) >= 0;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];

const validateVehicleMediaCreate = (req, res, next) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ success: false, message: 'Request body is required' });
  }

  const vehicleId = normalizeString(body.vehicleId);
  const fileName = normalizeString(body.fileName);
  const originalName = normalizeString(body.originalName);
  const mimeType = normalizeString(body.mimeType).toLowerCase();
  const url = normalizeString(body.url);
  const size = body.size;

  if (!vehicleId) {
    return res.status(400).json({ success: false, message: 'vehicleId is required' });
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
    return res.status(400).json({ success: false, message: 'url must be a valid absolute URL' });
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return res.status(400).json({ success: false, message: 'mimeType is not supported' });
  }

  return next();
};

const validateVehicleMediaUpdate = (req, res, next) => {
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
  if (body.url !== undefined) {
    const url = normalizeString(body.url);
    if (!url) {
      return res.status(400).json({ success: false, message: 'url cannot be empty when provided' });
    }
    if (!isValidUrl(url)) {
      return res.status(400).json({ success: false, message: 'url must be a valid absolute URL' });
    }
  }
  if (body.mimeType !== undefined) {
    const mimeType = normalizeString(body.mimeType).toLowerCase();
    if (!mimeType) {
      return res.status(400).json({ success: false, message: 'mimeType cannot be empty when provided' });
    }
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ success: false, message: 'mimeType is not supported' });
    }
  }

  return next();
};

module.exports = { validateVehicleMediaCreate, validateVehicleMediaUpdate };
