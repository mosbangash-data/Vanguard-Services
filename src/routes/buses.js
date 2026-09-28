const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');
const busController = require('../controllers/busController');

router.use(authenticateToken);

router.get('/', busController.listBuses);
router.post('/', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), busController.createBus);
router.get('/:id', busController.getBus);
router.put('/:id', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), busController.updateBus);
router.delete('/:id', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), busController.deleteBus);

module.exports = router;
