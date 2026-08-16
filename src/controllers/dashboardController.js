const dashboardService = require('../services/dashboardService');

const overview = async (req, res, next) => {
  try { const data = await dashboardService.getOverview(req.user); res.json({ success: true, data }); } catch (err) { next(err); }
};

module.exports = { overview };
