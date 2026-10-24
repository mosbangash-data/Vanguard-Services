const validateCreate = (req, res, next) => {
  const body = req.body || {};
  if (body.pricingBasis && !['WEIGHT', 'VOLUME'].includes(String(body.pricingBasis).toUpperCase())) {
    return res.status(400).json({ success: false, message: 'pricingBasis must be WEIGHT or VOLUME' });
  }
  const priceText = typeof body.amount === 'number' ? String(body.amount) : String(body.amount ?? '').trim();
  const price = Number(priceText);
  if (!/^\d+(?:\.\d{1,2})?$/.test(priceText) || !Number.isFinite(price) || price <= 0 || price > 99999999.99) {
    return res.status(400).json({ success: false, message: 'A valid positive parcel price with at most two decimal places is required' });
  }
  if (body.currency !== undefined && !/^[A-Za-z]{3}$/.test(String(body.currency).trim())) {
    return res.status(400).json({ success: false, message: 'currency must be a three-letter currency code' });
  }
  if (body.currency === undefined || !String(body.currency).trim()) {
    return res.status(400).json({ success: false, message: 'currency is required' });
  }
  if (!['AT_DEPOSIT', 'AT_PICKUP'].includes(String(body.paymentTiming || '').toUpperCase())) {
    return res.status(400).json({ success: false, message: 'paymentTiming must be AT_DEPOSIT or AT_PICKUP' });
  }
  const paymentMethod = String(body.paymentMethod || 'CASH').toUpperCase();
  if (!['CASH', 'MOBILE_MONEY'].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: 'paymentMethod must be CASH or MOBILE_MONEY' });
  }
  if (paymentMethod === 'CASH' && String(body.paymentTiming).toUpperCase() === 'AT_DEPOSIT' && body.cashCollected !== true) {
    return res.status(400).json({ success: false, message: 'Confirm that CASH was actually collected at deposit' });
  }
  if (paymentMethod === 'CASH' && String(body.paymentTiming).toUpperCase() === 'AT_PICKUP' && body.cashCollected === true) {
    return res.status(400).json({ success: false, message: 'Cash collected at deposit conflicts with payment due at pickup' });
  }
  if (paymentMethod === 'MOBILE_MONEY' && body.cashCollected === true) {
    return res.status(400).json({ success: false, message: 'Mobile Money cannot be marked as physically collected' });
  }
  req.body.paymentMethod = paymentMethod;
  if (!body.senderName || typeof body.senderName !== 'string' || !body.senderName.trim()) {
    return res.status(400).json({ success: false, message: 'senderName is required' });
  }
  if (!body.senderPhone || typeof body.senderPhone !== 'string' || !body.senderPhone.trim()) {
    return res.status(400).json({ success: false, message: 'senderPhone is required' });
  }
  if (!body.recipientName || typeof body.recipientName !== 'string' || !body.recipientName.trim()) {
    return res.status(400).json({ success: false, message: 'recipientName is required' });
  }
  if (!body.recipientPhone || typeof body.recipientPhone !== 'string' || !body.recipientPhone.trim()) {
    return res.status(400).json({ success: false, message: 'recipientPhone is required' });
  }
  const hasAssignedAgency = Boolean(req.user?.agencyId || req.user?.agency?.id);
  if (!hasAssignedAgency && (!body.originCity || typeof body.originCity !== 'string' || !body.originCity.trim())) {
    return res.status(400).json({ success: false, message: 'originCity is required' });
  }
  if (!body.destinationAgencyId && (!body.destinationCity || typeof body.destinationCity !== 'string' || !body.destinationCity.trim())) {
    return res.status(400).json({ success: false, message: 'destinationCity is required' });
  }
  next();
};

const validatePickup = (req, res, next) => {
  const body = req.body || {};
  if (!body.collectorName || typeof body.collectorName !== 'string' || !body.collectorName.trim()) {
    return res.status(400).json({ success: false, message: 'collectorName is required' });
  }
  if (!body.collectorPhone || typeof body.collectorPhone !== 'string' || !body.collectorPhone.trim()) {
    return res.status(400).json({ success: false, message: 'collectorPhone is required' });
  }
  if (!body.idType || typeof body.idType !== 'string' || !body.idType.trim()) {
    return res.status(400).json({ success: false, message: 'idType is required' });
  }
  if (!body.idNumber || typeof body.idNumber !== 'string' || !body.idNumber.trim()) {
    return res.status(400).json({ success: false, message: 'idNumber is required' });
  }
  next();
};

const validateStatusChange = (req, res, next) => {
  const body = req.body || {};
  if (!body.newStatus || typeof body.newStatus !== 'string' || !body.newStatus.trim()) {
    return res.status(400).json({ success: false, message: 'newStatus is required' });
  }
  next();
};

module.exports = {
  validateCreate,
  validatePickup,
  validateStatusChange,
};
