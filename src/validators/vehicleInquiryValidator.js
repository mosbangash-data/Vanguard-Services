const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_INQUIRY_TYPES = ['INFORMATION', 'PRICE_REQUEST', 'CONTACT'];
const VALID_CONTACT_PREFERENCES = ['PHONE', 'EMAIL', 'WHATSAPP', 'VISIT', 'OTHER'];
const VALID_STATUSES = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'CONVERTED', 'RESOLVED', 'CLOSED'];

const validateVehicleInquiryCreate = (req, res, next) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ success: false, message: 'Request body is required' });
  }

  const customerName = normalizeString(body.customerName);
  const customerPhone = normalizeString(body.customerPhone);
  const customerEmail = normalizeString(body.customerEmail);
  const vehicleId = normalizeString(body.vehicleId);
  const message = normalizeString(body.message);
  const inquiryType = normalizeString(body.inquiryType).toUpperCase();
  const contactPreference = normalizeString(body.contactPreference).toUpperCase();

  if (!customerName) {
    return res.status(400).json({ success: false, message: 'customerName is required' });
  }
  if (!customerPhone) {
    return res.status(400).json({ success: false, message: 'customerPhone is required' });
  }
  if (!vehicleId) {
    return res.status(400).json({ success: false, message: 'vehicleId is required' });
  }
  if (!message || message.length < 10) {
    return res.status(400).json({ success: false, message: 'message must be at least 10 characters' });
  }
  if (customerEmail && !EMAIL_REGEX.test(customerEmail)) {
    return res.status(400).json({ success: false, message: 'customerEmail must be a valid email address' });
  }
  if (inquiryType && !VALID_INQUIRY_TYPES.includes(inquiryType)) {
    return res.status(400).json({ success: false, message: 'inquiryType is invalid' });
  }
  if (contactPreference && !VALID_CONTACT_PREFERENCES.includes(contactPreference)) {
    return res.status(400).json({ success: false, message: 'contactPreference is invalid' });
  }

  return next();
};

const validateVehicleInquiryUpdate = (req, res, next) => {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ success: false, message: 'At least one field must be provided for update' });
  }

  const allowedFields = ['status', 'assignedToUserId', 'internalNotes', 'customerName', 'customerPhone', 'customerEmail', 'message', 'contactPreference'];
  const hasValidField = allowedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (!hasValidField) {
    return res.status(400).json({ success: false, message: 'No valid update fields provided' });
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return res.status(400).json({ success: false, message: 'status is invalid' });
  }
  if (body.assignedToUserId !== undefined && !normalizeString(body.assignedToUserId) && body.assignedToUserId !== null) {
    return res.status(400).json({ success: false, message: 'assignedToUserId must be a valid identifier or null' });
  }
  if (body.customerName !== undefined && normalizeString(body.customerName).length === 0) {
    return res.status(400).json({ success: false, message: 'customerName cannot be empty' });
  }
  if (body.customerPhone !== undefined && normalizeString(body.customerPhone).length === 0) {
    return res.status(400).json({ success: false, message: 'customerPhone cannot be empty' });
  }
  if (body.customerEmail !== undefined && body.customerEmail && !EMAIL_REGEX.test(normalizeString(body.customerEmail))) {
    return res.status(400).json({ success: false, message: 'customerEmail must be a valid email address' });
  }
  if (body.message !== undefined && body.message && normalizeString(body.message).length < 10) {
    return res.status(400).json({ success: false, message: 'message must be at least 10 characters' });
  }
  if (body.contactPreference !== undefined && body.contactPreference && !VALID_CONTACT_PREFERENCES.includes(normalizeString(body.contactPreference).toUpperCase())) {
    return res.status(400).json({ success: false, message: 'contactPreference is invalid' });
  }

  return next();
};

module.exports = { validateVehicleInquiryCreate, validateVehicleInquiryUpdate };