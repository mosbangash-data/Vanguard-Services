const managerDashboardService = require('../services/managerDashboardService');

const getManagerDashboard = async (req, res, next) => {
  try {
    const data = await managerDashboardService.getManagerDashboard(req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getManagerDashboard };
