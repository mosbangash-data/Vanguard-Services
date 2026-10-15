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
const { requireRole, requirePermission } = require('../middleware/permissionMiddleware');

const router = express.Router();

router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), requirePermission('VIEW_ROLE'), listRoles);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('CREATE_ROLE'), createRole);
router.get('/permissions', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('VIEW_PERMISSION'), listPermissions);
router.post('/permissions', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('CREATE_PERMISSION'), createPermission);
router.get('/permissions/:id', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('VIEW_PERMISSION'), getPermissionById);
router.put('/permissions/:id', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('UPDATE_PERMISSION'), updatePermission);
router.delete('/permissions/:id', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('DELETE_PERMISSION'), deletePermission);
router.get('/audit-logs', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), getAuditLogs);
router.get('/:id', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('VIEW_ROLE'), getRoleById);
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('UPDATE_ROLE'), updateRole);
router.delete('/:id', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('DELETE_ROLE'), deleteRole);
router.get('/:id/permissions', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('VIEW_ROLE'), getRolePermissions);
router.put('/:id/permissions', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('UPDATE_ROLE'), setRolePermissions);

module.exports = router;
