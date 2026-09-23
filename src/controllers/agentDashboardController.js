const agentDashboardService = require('../services/agentDashboardService');

const getAgentDashboard = async (req, res, next) => {
  try {
    const data = await agentDashboardService.getAgentDashboard(req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAgentDashboard };
