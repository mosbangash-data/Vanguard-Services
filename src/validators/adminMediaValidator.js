const validateAdminMediaCreate = (req, res, next) => {
  void req;
  void next;
  return res.status(410).json({ success: false, message: 'Direct Media creation is disabled. Use the validated upload endpoint.' });
};

module.exports = { validateAdminMediaCreate };
