const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'EXPIRED'];
const VALID_PAYMENT_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'COMPLETED'];

const validateVehicleReservationCreate = (req, res, next) => {
  const body = req.body;
  if (!body) return res.status(400).json({ success: false, message: 'Request body is required' });

  const vehicleId = normalizeString(body.vehicleId);
  const customerName = normalizeString(body.customerName);
  const customerPhone = normalizeString(body.customerPhone);
  const reservationAmount = normalizeString(body.reservationAmount);
  const depositAmount = body.depositAmount !== undefined && body.depositAmount !== null ? normalizeString(body.depositAmount) : null;
  const reservationDate = normalizeString(body.reservationDate);
  const expirationDate = body.expirationDate !== undefined && body.expirationDate !== null ? normalizeString(body.expirationDate) : null;
  const status = body.status !== undefined ? normalizeString(body.status).toUpperCase() : 'PENDING';
  const paymentStatus = body.paymentStatus !== undefined ? normalizeString(body.paymentStatus).toUpperCase() : 'PENDING';

  if (!vehicleId) return res.status(400).json({ success: false, message: 'vehicleId is required' });
  if (!customerName) return res.status(400).json({ success: false, message: 'customerName is required' });
  if (!customerPhone) return res.status(400).json({ success: false, message: 'customerPhone is required' });
  if (!reservationAmount) return res.status(400).json({ success: false, message: 'reservationAmount is required' });
  if (!reservationDate) return res.status(400).json({ success: false, message: 'reservationDate is required' });

  if (isNaN(Number(reservationAmount)) || Number(reservationAmount) < 0) {
    return res.status(400).json({ success: false, message: 'reservationAmount must be a valid positive number' });
  }

  if (depositAmount !== null && (isNaN(Number(depositAmount)) || Number(depositAmount) < 0)) {
    return res.status(400).json({ success: false, message: 'depositAmount must be a valid positive number' });
  }

  if (depositAmount !== null && Number(depositAmount) > Number(reservationAmount)) {
    return res.status(400).json({ success: false, message: 'depositAmount cannot exceed reservationAmount' });
  }

  if (!Number.isFinite(Date.parse(reservationDate))) {
    return res.status(400).json({ success: false, message: 'reservationDate must be a valid ISO date' });
  }

  if (expirationDate !== null && !Number.isFinite(Date.parse(expirationDate))) {
    return res.status(400).json({ success: false, message: 'expirationDate must be a valid ISO date' });
  }

  if (expirationDate !== null && new Date(expirationDate) <= new Date(reservationDate)) {
    return res.status(400).json({ success: false, message: 'expirationDate must be after reservationDate' });
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'status is invalid' });
  }

  if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
    return res.status(400).json({ success: false, message: 'paymentStatus is invalid' });
  }

  return next();
};

const validateVehicleReservationUpdate = (req, res, next) => {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ success: false, message: 'At least one field must be provided for update' });
  }

  const allowedFields = ['status', 'reservationAmount', 'depositAmount', 'paymentStatus', 'expirationDate', 'customerName', 'customerPhone', 'customerEmail', 'reservationDate', 'reason'];
  const hasValidField = allowedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (!hasValidField) return res.status(400).json({ success: false, message: 'No valid update fields provided' });

  if (body.status !== undefined && !VALID_STATUSES.includes(normalizeString(body.status).toUpperCase())) {
    return res.status(400).json({ success: false, message: 'status is invalid' });
  }

  if (body.paymentStatus !== undefined && !VALID_PAYMENT_STATUSES.includes(normalizeString(body.paymentStatus).toUpperCase())) {
    return res.status(400).json({ success: false, message: 'paymentStatus is invalid' });
  }

  if (body.reservationAmount !== undefined && (isNaN(Number(body.reservationAmount)) || Number(body.reservationAmount) < 0)) {
    return res.status(400).json({ success: false, message: 'reservationAmount must be a valid positive number' });
  }

  if (body.depositAmount !== undefined && body.depositAmount !== null && (isNaN(Number(body.depositAmount)) || Number(body.depositAmount) < 0)) {
    return res.status(400).json({ success: false, message: 'depositAmount must be a valid positive number' });
  }

  if (body.depositAmount !== undefined && body.reservationAmount !== undefined && Number(body.depositAmount) > Number(body.reservationAmount)) {
    return res.status(400).json({ success: false, message: 'depositAmount cannot exceed reservationAmount' });
  }

  if (body.reservationDate !== undefined && !Number.isFinite(Date.parse(normalizeString(body.reservationDate)))) {
    return res.status(400).json({ success: false, message: 'reservationDate must be a valid ISO date' });
  }

  if (body.expirationDate !== undefined && body.expirationDate !== null && !Number.isFinite(Date.parse(normalizeString(body.expirationDate)))) {
    return res.status(400).json({ success: false, message: 'expirationDate must be a valid ISO date' });
  }

  if (body.expirationDate !== undefined && body.reservationDate !== undefined && Number.isFinite(Date.parse(normalizeString(body.expirationDate))) && Number.isFinite(Date.parse(normalizeString(body.reservationDate)))) {
    if (new Date(body.expirationDate) <= new Date(body.reservationDate)) {
      return res.status(400).json({ success: false, message: 'expirationDate must be after reservationDate' });
    }
  }

  return next();
};

module.exports = { validateVehicleReservationCreate, validateVehicleReservationUpdate };