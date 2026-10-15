const express = require('express');
const { listUsers, getUserById, createUser, updateUser, updateUserStatus, resetUserPassword, deleteUser } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole, requirePermission } = require('../middleware/permissionMiddleware');
const { validateListUsersInput, validateCreateUserInput, validateStatusInput, validatePasswordResetInput } = require('../validators/userValidator');

const router = express.Router();

router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), requirePermission('VIEW_USER'), validateListUsersInput, listUsers);
router.get('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), requirePermission('VIEW_USER'), getUserById);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), requirePermission('CREATE_USER'), validateCreateUserInput, createUser);
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), requirePermission('UPDATE_USER'), updateUser);
router.patch('/:id/status', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), requirePermission('UPDATE_USER'), validateStatusInput, updateUserStatus);
router.patch('/:id/password-reset', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), requirePermission('UPDATE_USER'), validatePasswordResetInput, resetUserPassword);
router.post('/:id/password-reset', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), requirePermission('UPDATE_USER'), validatePasswordResetInput, resetUserPassword);
router.put('/:id/password-reset', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), requirePermission('UPDATE_USER'), validatePasswordResetInput, resetUserPassword);
router.delete('/:id', authenticateToken, requireRole('SUPER_ADMIN'), requirePermission('DELETE_USER'), deleteUser);

module.exports = router;
