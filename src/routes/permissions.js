const express = require('express');
const {
  listPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
} = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');

const router = express.Router();

router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), listPermissions);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN'), createPermission);
router.get('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), getPermissionById);
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN'), updatePermission);
router.delete('/:id', authenticateToken, requireRole('SUPER_ADMIN'), deletePermission);

module.exports = router;
