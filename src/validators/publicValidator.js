const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_PUBLIC_PAYMENT_METHODS = ['CASH'];

const validatePublicReservationCreate = (req, res, next) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ success: false, message: 'Request body is required' });
  }

  const tripId = normalizeString(body.tripId);
  const customerName = normalizeString(body.customerName);
  const customerPhone = normalizeString(body.customerPhone);
  const seatNumber = normalizeString(body.seatNumber === undefined || body.seatNumber === null ? '' : String(body.seatNumber));
  const customerEmail = normalizeString(body.customerEmail);

  if (!tripId) {
    return res.status(400).json({ success: false, message: 'tripId is required' });
  }
  if (!customerName) {
    return res.status(400).json({ success: false, message: 'customerName is required' });
  }
  if (!customerPhone) {
    return res.status(400).json({ success: false, message: 'customerPhone is required' });
  }
  if (!seatNumber) {
    return res.status(400).json({ success: false, message: 'seatNumber is required' });
  }
  if (customerEmail && !EMAIL_REGEX.test(customerEmail)) {
    return res.status(400).json({ success: false, message: 'customerEmail must be a valid email address' });
  }

  return next();
};

const validatePublicReservationPaymentCreate = (req, res, next) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ success: false, message: 'Request body is required' });
  }

  const amount = body.amount;
  const method = normalizeString(body.method).toUpperCase();

  if (amount === undefined || amount === null || amount === '') {
    return res.status(400).json({ success: false, message: 'amount is required' });
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return res.status(400).json({ success: false, message: 'amount must be a positive number' });
  }
  if (!method) {
    return res.status(400).json({ success: false, message: 'method is required' });
  }
  if (!ALLOWED_PUBLIC_PAYMENT_METHODS.includes(method)) {
    return res.status(400).json({
      success: false,
      message: 'Only CASH is supported for public reservations.',
    });
  }
  if (
    body.status !== undefined ||
    body.validatedById !== undefined ||
    body.validatedAt !== undefined ||
    body.providerTransactionId !== undefined ||
    body.providerReference !== undefined ||
    body.channel !== undefined ||
    body.currency !== undefined ||
    body.provider !== undefined ||
    body.approved !== undefined ||
    body.confirmed !== undefined ||
    body.ticketGenerated !== undefined
  ) {
    return res.status(400).json({
      success: false,
      message: 'Payment status and validation fields are managed server-side only.',
    });
  }

  return next();
};

const validatePublicCustomerRequestCreate = (req, res, next) => {
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

const validatePublicQuoteRequestCreate = (req, res, next) => {
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

const validatePublicVehicleInquiryCreate = (req, res, next) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ success: false, message: 'Request body is required' });
  }

  const vehicleId = normalizeString(body.vehicleId);
  const customerName = normalizeString(body.customerName);
  const message = normalizeString(body.message);
  const customerEmail = normalizeString(body.customerEmail);

  if (!vehicleId) {
    return res.status(400).json({ success: false, message: 'vehicleId is required' });
  }
  if (!customerName) {
    return res.status(400).json({ success: false, message: 'customerName is required' });
  }
  if (!message || message.length < 10) {
    return res.status(400).json({ success: false, message: 'message is required and must be at least 10 characters' });
  }
  if (customerEmail && !EMAIL_REGEX.test(customerEmail)) {
    return res.status(400).json({ success: false, message: 'customerEmail must be a valid email address' });
  }

  return next();
};

module.exports = {
  validatePublicReservationCreate,
  validatePublicReservationPaymentCreate,
  validatePublicCustomerRequestCreate,
  validatePublicQuoteRequestCreate,
  validatePublicVehicleInquiryCreate,
};