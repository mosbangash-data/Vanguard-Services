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
const { requireRole, requirePermission } = require('../middleware/permissionMiddleware');

const router = express.Router();

router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), listDepartments);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('CREATE_DEPARTMENT'), createDepartment);
router.get('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), getDepartmentById);
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('UPDATE_DEPARTMENT'), updateDepartment);
router.delete('/:id', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('DELETE_DEPARTMENT'), deleteDepartment);

// Department Settings & Payment Methods
router.get('/:id/settings', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), getDepartmentSettings);
router.put('/:id/settings', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), updateDepartmentSettings);
router.patch('/:id/settings', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), updateDepartmentSettings);

router.get('/:id/payment-methods', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), listPaymentMethods);
router.post('/:id/payment-methods', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), createPaymentMethod);
router.put('/:id/payment-methods/:code', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), updatePaymentMethod);
router.patch('/:id/payment-methods/:code', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), updatePaymentMethod);
router.delete('/:id/payment-methods/:code', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), deletePaymentMethod);

module.exports = router;
