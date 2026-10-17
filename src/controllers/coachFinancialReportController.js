const service = require('../services/coachFinancialReportService');
exports.getReport = async (req, res, next) => {
  try { res.json({ success: true, data: await service.getCoachFinancialReport(req.query, req.user) }); }
  catch (error) { next(error); }
};
