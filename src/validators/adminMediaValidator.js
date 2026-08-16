const ENTITY_TYPE_REGEX = /^[A-Za-z0-9_\-]+$/;

const validateAdminMediaCreate = (req, res, next) => {
  const body = req.body;
  if (!body) return res.status(400).json({ success: false, message: 'Request body is required' });
  const required = ['fileName', 'originalName', 'mimeType', 'size', 'url', 'entityType', 'entityId'];
  for (const f of required) {
    if (body[f] === undefined || body[f] === null) return res.status(400).json({ success: false, message: `${f} is required` });
  }
  if (typeof body.fileName !== 'string' || body.fileName.trim() === '') return res.status(400).json({ success: false, message: 'fileName must be a string' });
  if (typeof body.originalName !== 'string' || body.originalName.trim() === '') return res.status(400).json({ success: false, message: 'originalName must be a string' });
  if (typeof body.mimeType !== 'string' || body.mimeType.trim() === '') return res.status(400).json({ success: false, message: 'mimeType must be a string' });
  if (!Number.isFinite(Number(body.size)) || Number(body.size) < 0) return res.status(400).json({ success: false, message: 'size must be a non-negative number' });
  if (typeof body.url !== 'string' || body.url.trim() === '') return res.status(400).json({ success: false, message: 'url must be a string' });
  if (typeof body.entityType !== 'string' || body.entityType.trim() === '') return res.status(400).json({ success: false, message: 'entityType must be a non-empty string' });
  if (!ENTITY_TYPE_REGEX.test(body.entityType.trim())) return res.status(400).json({ success: false, message: 'entityType contains invalid characters' });
  if (typeof body.entityId !== 'string' || body.entityId.trim() === '') return res.status(400).json({ success: false, message: 'entityId must be a non-empty string' });
  return next();
};

module.exports = { validateAdminMediaCreate };
