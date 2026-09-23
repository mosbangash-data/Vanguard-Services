const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAnyPermission } = require('../middleware/permissionMiddleware');
const agentDashboardController = require('../controllers/agentDashboardController');

router.use(authenticateToken);
router.get(
  '/',
  requireAnyPermission('VIEW_TRIP', 'VIEW_RESERVATION', 'VIEW_PAYMENT', 'SCAN_TICKET', 'VIEW_TICKET_SCAN', 'VIEW_PARCEL'),
  agentDashboardController.getAgentDashboard,
);

module.exports = router;
