const express = require('express');
const { listUsers, getUserById, createUser, updateUser, updateUserStatus, resetUserPassword, deleteUser } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');
const { validateListUsersInput, validateCreateUserInput, validateStatusInput, validatePasswordResetInput } = require('../validators/userValidator');

const router = express.Router();

router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), validateListUsersInput, listUsers);
router.get('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), getUserById);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), validateCreateUserInput, createUser);
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), updateUser);
router.patch('/:id/status', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), validateStatusInput, updateUserStatus);
router.patch('/:id/password-reset', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), validatePasswordResetInput, resetUserPassword);
router.post('/:id/password-reset', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), validatePasswordResetInput, resetUserPassword);
router.put('/:id/password-reset', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN', 'CONSTRUCTION'), validatePasswordResetInput, resetUserPassword);
router.delete('/:id', authenticateToken, requireRole('SUPER_ADMIN'), deleteUser);

module.exports = router;
