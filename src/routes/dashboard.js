const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');
const dashboardController = require('../controllers/dashboardController');

router.use(authenticateToken);

router.get('/overview', dashboardController.overview);
router.get('/vanguard-coach-sales', requireRole('SUPER_ADMIN'), dashboardController.coachSalesReport);

module.exports = router;

