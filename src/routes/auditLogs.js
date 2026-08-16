const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');
const auditController = require('../controllers/auditController');

router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), auditController.listLogs);
router.get('/recent', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), auditController.recent);

module.exports = router;
