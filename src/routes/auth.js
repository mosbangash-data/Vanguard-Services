const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, getProfile } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const {
  validateLoginInput,
} = require('../validators/authValidator');

const router = express.Router();

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
  },
});

router.post('/login', loginRateLimiter, validateLoginInput, login);
router.get('/me', authenticateToken, getProfile);
router.get('/protected', authenticateToken, requirePermission('CREATE_RESERVATION'), (req, res) => {
  res.status(200).json({ success: true, message: 'Protected route access granted' });
});

module.exports = router;
