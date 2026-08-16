const express = require('express');
const {
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');

const router = express.Router();

router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), listDepartments);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN'), createDepartment);
router.get('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), getDepartmentById);
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN'), updateDepartment);
router.delete('/:id', authenticateToken, requireRole('SUPER_ADMIN'), deleteDepartment);

module.exports = router;
