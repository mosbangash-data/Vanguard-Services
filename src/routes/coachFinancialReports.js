const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/coachFinancialReportController');
const router = express.Router();
router.use(authenticateToken, requirePermission('VIEW_PAYMENT'));
router.get('/', controller.getReport);
module.exports = router;
