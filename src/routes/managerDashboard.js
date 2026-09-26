const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/managerDashboardController');

router.use(authenticateToken);
router.get('/dashboard', requireRole('MANAGER'), controller.getManagerDashboard);

module.exports = router;
