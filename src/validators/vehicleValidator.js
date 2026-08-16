const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const isValidYear = (value) => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1886 && year <= new Date().getFullYear() + 1;
};
const isValidDecimal = (value) => {
  const normalized = normalizeString(value);
  return /^[0-9]+(\.[0-9]{1,2})?$/.test(normalized) && Number(normalized) >= 0;
};

const validateVehicleCreate = (req, res, next) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ success: false, message: 'Request body is required' });
  }

  const departmentId = normalizeString(body.departmentId);
  const brand = normalizeString(body.brand);
  const model = normalizeString(body.model);
  const year = body.year;
  const price = normalizeString(body.price);
  const mileage = body.mileage;

  if (!departmentId) {
    return res.status(400).json({ success: false, message: 'departmentId is required' });
  }
  if (!brand) {
    return res.status(400).json({ success: false, message: 'brand is required' });
  }
  if (!model) {
    return res.status(400).json({ success: false, message: 'model is required' });
  }
  if (year === undefined || year === null || !isValidYear(year)) {
    return res.status(400).json({ success: false, message: 'year is required and must be a valid number between 1886 and next year' });
  }
  if (!price || !isValidDecimal(price)) {
    return res.status(400).json({ success: false, message: 'price is required and must be a valid positive amount' });
  }
  if (mileage !== undefined && mileage !== null && (!Number.isInteger(Number(mileage)) || Number(mileage) < 0)) {
    return res.status(400).json({ success: false, message: 'mileage must be a non-negative integer' });
  }

  return next();
};

const validateVehicleUpdate = (req, res, next) => {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ success: false, message: 'At least one field must be provided for update' });
  }

  const allowedFields = ['departmentId', 'brand', 'model', 'year', 'price', 'currency', 'mileage', 'fuelType', 'transmission', 'color', 'description', 'status'];
  const hasValidField = allowedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (!hasValidField) {
    return res.status(400).json({ success: false, message: 'No valid update fields provided' });
  }

  if (body.departmentId !== undefined && !normalizeString(body.departmentId)) {
    return res.status(400).json({ success: false, message: 'departmentId cannot be empty' });
  }
  if (body.brand !== undefined && !normalizeString(body.brand)) {
    return res.status(400).json({ success: false, message: 'brand cannot be empty' });
  }
  if (body.model !== undefined && !normalizeString(body.model)) {
    return res.status(400).json({ success: false, message: 'model cannot be empty' });
  }
  if (body.year !== undefined && !isValidYear(body.year)) {
    return res.status(400).json({ success: false, message: 'year must be a valid number between 1886 and next year' });
  }
  if (body.price !== undefined) {
    if (body.price === null) {
      return res.status(400).json({ success: false, message: 'price cannot be null' });
    }
    if (!isValidDecimal(body.price)) {
      return res.status(400).json({ success: false, message: 'price must be a valid positive amount' });
    }
  }
  if (body.mileage !== undefined && body.mileage !== null && (!Number.isInteger(Number(body.mileage)) || Number(body.mileage) < 0)) {
    return res.status(400).json({ success: false, message: 'mileage must be a non-negative integer' });
  }
  if (body.currency !== undefined && !['USD', 'CDF'].includes(normalizeString(body.currency).toUpperCase())) {
    return res.status(400).json({ success: false, message: 'currency must be USD or CDF' });
  }
  if (body.status !== undefined) {
    const validStatuses = ['AVAILABLE', 'RESERVED', 'SOLD', 'IN_MAINTENANCE'];
    if (!validStatuses.includes(normalizeString(body.status).toUpperCase())) {
      return res.status(400).json({ success: false, message: 'status is invalid' });
    }
  }

  return next();
};

module.exports = { validateVehicleCreate, validateVehicleUpdate };
