const express = require('express');
const {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
  getAuditLogs,
} = require('../controllers/adminController');
const { getRolePermissions, setRolePermissions } = require('../controllers/roleController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');

const router = express.Router();

router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), listRoles);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN'), createRole);
router.get('/permissions', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), listPermissions);
router.post('/permissions', authenticateToken, requireRole('SUPER_ADMIN'), createPermission);
router.get('/permissions/:id', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), getPermissionById);
router.put('/permissions/:id', authenticateToken, requireRole('SUPER_ADMIN'), updatePermission);
router.delete('/permissions/:id', authenticateToken, requireRole('SUPER_ADMIN'), deletePermission);
router.get('/audit-logs', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), getAuditLogs);
router.get('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), getRoleById);
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN'), updateRole);
router.delete('/:id', authenticateToken, requireRole('SUPER_ADMIN'), deleteRole);
router.get('/:id/permissions', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), getRolePermissions);
router.put('/:id/permissions', authenticateToken, requireRole('SUPER_ADMIN'), setRolePermissions);

module.exports = router;
