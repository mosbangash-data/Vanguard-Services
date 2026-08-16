const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');
const adminMediaController = require('../controllers/adminMediaController');
const { validateAdminMediaCreate } = require('../validators/adminMediaValidator');

router.use(authenticateToken);

router.post('/', requireRole('SUPER_ADMIN'), validateAdminMediaCreate, adminMediaController.createMedia);

module.exports = router;
