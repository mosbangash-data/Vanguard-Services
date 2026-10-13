const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole, requirePermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/cashClosureController');

const router = express.Router();
router.use(authenticateToken);
router.get('/', requireRole('MANAGER'), controller.getDay);
router.post('/', requireRole('MANAGER'), controller.saveDraft);
router.get('/:id', requireRole('MANAGER', 'SERVICE_ADMIN', 'SUPER_ADMIN'), controller.getById);
router.post('/:id/submit', requireRole('MANAGER'), controller.submit);
router.post('/:id/approve', requirePermission('APPROVE_DAILY_CASH_CLOSURE'), controller.approve);
router.post('/:id/reject', requirePermission('APPROVE_DAILY_CASH_CLOSURE'), controller.reject);
router.post('/:id/corrections', requireRole('MANAGER'), controller.createCorrection);
router.post('/:id/corrections/:correctionId/approve', requirePermission('APPROVE_DAILY_CASH_CLOSURE'), controller.approveCorrection);
router.post('/:id/corrections/:correctionId/reject', requirePermission('APPROVE_DAILY_CASH_CLOSURE'), controller.rejectCorrection);
module.exports = router;