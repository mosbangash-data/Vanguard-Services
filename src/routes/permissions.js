const express = require('express');
const {
  listPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
} = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole, requirePermission } = require('../middleware/permissionMiddleware');

const router = express.Router();

router.get('/', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('VIEW_PERMISSION'), listPermissions);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('CREATE_PERMISSION'), createPermission);
router.get('/:id', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('VIEW_PERMISSION'), getPermissionById);
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('UPDATE_PERMISSION'), updatePermission);
router.delete('/:id', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('DELETE_PERMISSION'), deletePermission);

module.exports = router;
