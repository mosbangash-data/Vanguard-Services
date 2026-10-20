const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');
const dashboardController = require('../controllers/dashboardController');
const managerDashboardController = require('../controllers/managerDashboardController');

router.use(authenticateToken);

router.get('/overview', dashboardController.overview);
router.get('/service-admin', requireRole('SERVICE_ADMIN'), managerDashboardController.getManagerDashboard);
router.get('/vanguard-coach-sales', requireRole('SUPER_ADMIN'), dashboardController.coachSalesReport);

module.exports = router;

