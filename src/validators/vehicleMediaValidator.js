const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) >= 0;

const validateVehicleMediaCreate = (req, res, next) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ success: false, message: 'Request body is required' });
  }

  const vehicleId = normalizeString(body.vehicleId);
  const mediaId = normalizeString(body.mediaId);

  if (!vehicleId) {
    return res.status(400).json({ success: false, message: 'vehicleId is required' });
  }
  if (!mediaId) return res.status(400).json({ success: false, message: 'mediaId is required. Upload the file through /api/upload first.' });

  return next();
};

const validateVehicleMediaUpdate = (req, res, next) => {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ success: false, message: 'At least one field must be provided for update' });
  }

  const allowedFields = ['caption', 'order', 'isPrimary'];
  const hasValidField = allowedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));

  if (!hasValidField) {
    return res.status(400).json({ success: false, message: 'No valid update fields provided' });
  }

  if (body.order !== undefined && !isPositiveInteger(body.order)) {
    return res.status(400).json({ success: false, message: 'order must be a non-negative integer' });
  }

  return next();
};

module.exports = { validateVehicleMediaCreate, validateVehicleMediaUpdate };
