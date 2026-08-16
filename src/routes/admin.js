const express = require('express');
const { getAuditLogs } = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');

const router = express.Router();

router.get('/audit-logs', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), getAuditLogs);

module.exports = router;
