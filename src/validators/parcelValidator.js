const validateCreate = (req, res, next) => {
  const body = req.body || {};
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
  if (!body.originCity || typeof body.originCity !== 'string' || !body.originCity.trim()) {
    return res.status(400).json({ success: false, message: 'originCity is required' });
  }
  if (!body.destinationCity || typeof body.destinationCity !== 'string' || !body.destinationCity.trim()) {
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
