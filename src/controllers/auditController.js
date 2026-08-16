const auditService = require('../services/auditService');

const listLogs = async (req, res, next) => {
  try { const result = await auditService.getLogs(req.query, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const recent = async (req, res, next) => {
  try { const result = await auditService.getRecentLogs(req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

module.exports = { listLogs, recent };
