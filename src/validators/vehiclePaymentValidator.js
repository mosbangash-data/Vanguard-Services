const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const validateVehiclePaymentCreate = (req, res, next) => {
  const body = req.body;
  if (!body) return res.status(400).json({ success: false, message: 'Request body is required' });

  const reservationId = normalizeString(body.reservationId);
  const amount = normalizeString(body.amount);
  const method = normalizeString(body.method);
  const reference = body.reference !== undefined && body.reference !== null ? normalizeString(body.reference) : null;
  const comment = body.comment !== undefined && body.comment !== null ? normalizeString(body.comment) : null;

  if (!reservationId) return res.status(400).json({ success: false, message: 'reservationId is required' });
  if (!amount) return res.status(400).json({ success: false, message: 'amount is required' });
  if (!method) return res.status(400).json({ success: false, message: 'method is required' });

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ success: false, message: 'amount must be a valid positive number' });
  }

  if (reference !== null && reference.length > 255) {
    return res.status(400).json({ success: false, message: 'reference is too long' });
  }

  if (comment !== null && comment.length > 1000) {
    return res.status(400).json({ success: false, message: 'comment is too long' });
  }

  return next();
};

const validateVehiclePaymentUpdate = (req, res, next) => {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ success: false, message: 'At least one field must be provided for update' });
  }

  const allowedFields = ['amount', 'method', 'reference', 'comment'];
  const hasValidField = allowedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (!hasValidField) {
    return res.status(400).json({ success: false, message: 'No valid fields provided for update' });
  }

  if (body.amount !== undefined) {
    const amount = normalizeString(body.amount);
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a valid positive number' });
    }
  }

  if (body.method !== undefined) {
    const method = normalizeString(body.method);
    if (!method) {
      return res.status(400).json({ success: false, message: 'method is required' });
    }
  }

  if (body.reference !== undefined && body.reference !== null) {
    const reference = normalizeString(body.reference);
    if (reference.length > 255) {
      return res.status(400).json({ success: false, message: 'reference is too long' });
    }
  }

  if (body.comment !== undefined && body.comment !== null) {
    const comment = normalizeString(body.comment);
    if (comment.length > 1000) {
      return res.status(400).json({ success: false, message: 'comment is too long' });
    }
  }

  return next();
};

module.exports = { validateVehiclePaymentCreate, validateVehiclePaymentUpdate };