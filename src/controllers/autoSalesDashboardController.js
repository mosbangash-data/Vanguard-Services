const autoSalesDashboardService = require('../services/autoSalesDashboardService');

const getAutoSalesDashboard = async (req, res, next) => {
  try {
    const data = await autoSalesDashboardService.getDashboard(req.user);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

module.exports = { getAutoSalesDashboard };
