const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, getProfile, changePassword, forgotPassword, resetPassword } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const {
  validateLoginInput,
  validateChangePasswordInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
} = require('../validators/authValidator');

const router = express.Router();

const isTestEnv = process.env.NODE_ENV === 'test';

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
  },
});

const passwordActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password requests, please try again later.',
  },
});

router.post('/login', loginRateLimiter, validateLoginInput, login);
router.get('/me', authenticateToken, getProfile);
router.post('/change-password', authenticateToken, validateChangePasswordInput, changePassword);
router.post('/forgot-password', passwordActionLimiter, validateForgotPasswordInput, forgotPassword);
router.post('/reset-password', passwordActionLimiter, validateResetPasswordInput, resetPassword);
router.get('/protected', authenticateToken, requirePermission('CREATE_RESERVATION'), (req, res) => {
  res.status(200).json({ success: true, message: 'Protected route access granted' });
});

module.exports = router;
