const express = require('express');
const { listUsers, getUserById, createUser, updateUser, updateUserStatus, resetUserPassword } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');
const { validateListUsersInput, validateCreateUserInput, validateStatusInput, validatePasswordResetInput } = require('../validators/userValidator');

const router = express.Router();

router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), validateListUsersInput, listUsers);
router.get('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), getUserById);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), validateCreateUserInput, createUser);
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), updateUser);
router.patch('/:id/status', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), validateStatusInput, updateUserStatus);
router.patch('/:id/password-reset', authenticateToken, requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), validatePasswordResetInput, resetUserPassword);

module.exports = router;
