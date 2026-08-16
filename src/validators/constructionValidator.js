const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_CUSTOMER_REQUEST_STATUSES = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'CONVERTED', 'RESOLVED', 'CLOSED'];
const VALID_QUOTE_REQUEST_STATUSES = ['NEW', 'IN_PROGRESS', 'WAITING_FOR_CLIENT', 'CLOSED'];
const VALID_PROJECT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const VALID_PUBLICATION_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

const validateCustomerRequestCreate = (req, res, next) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ success: false, message: 'Request body is required' });
  }

  const subject = normalizeString(body.subject);
  const customerName = normalizeString(body.customerName);
  const customerPhone = normalizeString(body.customerPhone);
  const message = normalizeString(body.message);
  const customerEmail = normalizeString(body.customerEmail);

  if (!subject) {
    return res.status(400).json({ success: false, message: 'subject is required' });
  }
  if (!customerName) {
    return res.status(400).json({ success: false, message: 'customerName is required' });
  }
  if (!customerPhone) {
    return res.status(400).json({ success: false, message: 'customerPhone is required' });
  }
  if (!message || message.length < 10) {
    return res.status(400).json({ success: false, message: 'message is required and must be at least 10 characters' });
  }
  if (customerEmail && !EMAIL_REGEX.test(customerEmail)) {
    return res.status(400).json({ success: false, message: 'customerEmail must be a valid email address' });
  }

  return next();
};

const validateCustomerRequestUpdate = (req, res, next) => {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ success: false, message: 'At least one field must be provided for update' });
  }

  const allowedFields = ['subject', 'customerName', 'customerPhone', 'customerEmail', 'message', 'status', 'assignedToUserId', 'departmentId'];
  const hasValidField = allowedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (!hasValidField) {
    return res.status(400).json({ success: false, message: 'No valid update fields provided' });
  }

  if (body.customerEmail !== undefined && body.customerEmail && !EMAIL_REGEX.test(normalizeString(body.customerEmail))) {
    return res.status(400).json({ success: false, message: 'customerEmail must be a valid email address' });
  }
  if (body.status !== undefined && !VALID_CUSTOMER_REQUEST_STATUSES.includes(body.status)) {
    return res.status(400).json({ success: false, message: 'status is invalid' });
  }

  return next();
};

const validateQuoteRequestCreate = (req, res, next) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ success: false, message: 'Request body is required' });
  }

  const customerName = normalizeString(body.customerName);
  const customerPhone = normalizeString(body.customerPhone);
  const description = normalizeString(body.description);
  const customerEmail = normalizeString(body.customerEmail);

  if (!customerName) {
    return res.status(400).json({ success: false, message: 'customerName is required' });
  }
  if (!customerPhone) {
    return res.status(400).json({ success: false, message: 'customerPhone is required' });
  }
  if (!description || description.length < 10) {
    return res.status(400).json({ success: false, message: 'description is required and must be at least 10 characters' });
  }
  if (customerEmail && !EMAIL_REGEX.test(customerEmail)) {
    return res.status(400).json({ success: false, message: 'customerEmail must be a valid email address' });
  }

  return next();
};

const validateQuoteRequestUpdate = (req, res, next) => {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ success: false, message: 'At least one field must be provided for update' });
  }

  const allowedFields = ['projectType', 'description', 'budgetRange', 'customerName', 'customerPhone', 'customerEmail', 'status', 'assignedToUserId', 'departmentId'];
  const hasValidField = allowedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (!hasValidField) {
    return res.status(400).json({ success: false, message: 'No valid update fields provided' });
  }

  if (body.customerEmail !== undefined && body.customerEmail && !EMAIL_REGEX.test(normalizeString(body.customerEmail))) {
    return res.status(400).json({ success: false, message: 'customerEmail must be a valid email address' });
  }
  if (body.status !== undefined && !VALID_QUOTE_REQUEST_STATUSES.includes(body.status)) {
    return res.status(400).json({ success: false, message: 'status is invalid' });
  }

  return next();
};

const validateProjectCreate = (req, res, next) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ success: false, message: 'Request body is required' });
  }

  const title = normalizeString(body.title);
  const departmentId = normalizeString(body.departmentId);
  const budget = body.budget;

  if (!title) {
    return res.status(400).json({ success: false, message: 'title is required' });
  }
  if (!departmentId) {
    return res.status(400).json({ success: false, message: 'departmentId is required' });
  }
  if (budget !== undefined && budget !== null) {
    const numberBudget = Number(budget);
    if (!Number.isFinite(numberBudget) || numberBudget < 0) {
      return res.status(400).json({ success: false, message: 'budget must be a valid non-negative number' });
    }
  }

  return next();
};

const validateProjectUpdate = (req, res, next) => {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ success: false, message: 'At least one field must be provided for update' });
  }

  const allowedFields = ['title', 'slug', 'location', 'description', 'budget', 'status', 'publicationStatus', 'departmentId'];
  const hasValidField = allowedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (!hasValidField) {
    return res.status(400).json({ success: false, message: 'No valid update fields provided' });
  }

  if (body.budget !== undefined && body.budget !== null) {
    const numberBudget = Number(body.budget);
    if (!Number.isFinite(numberBudget) || numberBudget < 0) {
      return res.status(400).json({ success: false, message: 'budget must be a valid non-negative number' });
    }
  }
  if (body.status !== undefined && !VALID_PROJECT_STATUSES.includes(body.status)) {
    return res.status(400).json({ success: false, message: 'status is invalid' });
  }
  if (body.publicationStatus !== undefined && !VALID_PUBLICATION_STATUSES.includes(body.publicationStatus)) {
    return res.status(400).json({ success: false, message: 'publicationStatus is invalid' });
  }

  return next();
};

// Exports moved to bottom after additional validators

const validateProjectUpdateCreate = (req, res, next) => {
  const body = req.body;
  if (!body) return res.status(400).json({ success: false, message: 'Request body is required' });

  const title = normalizeString(body.title);
  const description = normalizeString(body.description);

  if (!title) return res.status(400).json({ success: false, message: 'title is required' });
  if (!description || description.length < 5) return res.status(400).json({ success: false, message: 'description is required and must be at least 5 characters' });

  return next();
};

const validateProjectUpdateUpdate = (req, res, next) => {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) return res.status(400).json({ success: false, message: 'At least one field must be provided for update' });

  const allowedFields = ['title', 'description'];
  const hasValidField = allowedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (!hasValidField) return res.status(400).json({ success: false, message: 'No valid update fields provided' });

  return next();
};

const validateProjectGalleryCreate = (req, res, next) => {
  const body = req.body;
  const params = req.params || {};
  if (!params.projectId) return res.status(400).json({ success: false, message: 'projectId is required in path' });
  if (!body) return res.status(400).json({ success: false, message: 'Request body is required' });
  if (!body.mediaId) return res.status(400).json({ success: false, message: 'mediaId is required' });

  if (body.caption !== undefined && typeof body.caption !== 'string') return res.status(400).json({ success: false, message: 'caption must be a string' });
  if (body.order !== undefined) {
    const o = Number(body.order);
    if (!Number.isInteger(o) || o < 0) return res.status(400).json({ success: false, message: 'order must be a non-negative integer' });
  }

  return next();
};

const validateProjectGalleryUpdate = (req, res, next) => {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) return res.status(400).json({ success: false, message: 'At least one field must be provided for update' });

  const allowedFields = ['caption', 'order'];
  const hasValidField = allowedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (!hasValidField) return res.status(400).json({ success: false, message: 'No valid update fields provided' });

  if (body.caption !== undefined && typeof body.caption !== 'string') return res.status(400).json({ success: false, message: 'caption must be a string' });
  if (body.order !== undefined) {
    const o = Number(body.order);
    if (!Number.isInteger(o) || o < 0) return res.status(400).json({ success: false, message: 'order must be a non-negative integer' });
  }

  return next();
};

const validateProjectGallerySetPrimary = (req, res, next) => {
  const params = req.params || {};
  if (!params.id) return res.status(400).json({ success: false, message: 'gallery id is required' });
  return next();
};

module.exports = {
  validateCustomerRequestCreate,
  validateCustomerRequestUpdate,
  validateQuoteRequestCreate,
  validateQuoteRequestUpdate,
  validateProjectCreate,
  validateProjectUpdate,
  validateProjectUpdateCreate,
  validateProjectUpdateUpdate,
  validateProjectGalleryCreate,
  validateProjectGalleryUpdate,
  validateProjectGallerySetPrimary,
};