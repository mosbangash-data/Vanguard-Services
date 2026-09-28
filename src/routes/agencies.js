const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');
const agencyController = require('../controllers/agencyController');

router.use(authenticateToken);

router.get('/', agencyController.listAgencies);
router.post('/', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), agencyController.createAgency);
router.get('/:id', agencyController.getAgency);
router.put('/:id', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), agencyController.updateAgency);
router.delete('/:id', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), agencyController.deleteAgency);

module.exports = router;
