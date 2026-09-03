const express = require('express');
const {
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentSettings,
  updateDepartmentSettings,
  listPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');

const router = express.Router();

router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), listDepartments);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN'), createDepartment);
router.get('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), getDepartmentById);
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN'), updateDepartment);
router.delete('/:id', authenticateToken, requireRole('SUPER_ADMIN'), deleteDepartment);

// Department Settings & Payment Methods
router.get('/:id/settings', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), getDepartmentSettings);
router.put('/:id/settings', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), updateDepartmentSettings);
router.patch('/:id/settings', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), updateDepartmentSettings);

router.get('/:id/payment-methods', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), listPaymentMethods);
router.post('/:id/payment-methods', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), createPaymentMethod);
router.put('/:id/payment-methods/:code', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), updatePaymentMethod);
router.patch('/:id/payment-methods/:code', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), updatePaymentMethod);
router.delete('/:id/payment-methods/:code', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), deletePaymentMethod);

module.exports = router;
