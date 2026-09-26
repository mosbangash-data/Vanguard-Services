const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const controller = require('../controllers/autoSalesDashboardController');

router.use(authenticateToken);
router.get('/', controller.getAutoSalesDashboard);

module.exports = router;
