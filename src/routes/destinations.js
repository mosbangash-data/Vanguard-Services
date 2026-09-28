const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');
const destinationController = require('../controllers/destinationController');

router.use(authenticateToken);

router.get('/', destinationController.listDestinations);
router.post('/', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), destinationController.createDestination);
router.get('/:id', destinationController.getDestination);
router.put('/:id', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), destinationController.updateDestination);
router.delete('/:id', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), destinationController.deleteDestination);

module.exports = router;
