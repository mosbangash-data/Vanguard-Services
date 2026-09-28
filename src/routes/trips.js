const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission, requireRole } = require('../middleware/permissionMiddleware');
const tripController = require('../controllers/tripController');

router.use(authenticateToken);

router.get('/', requirePermission('VIEW_TRIP'), tripController.listTrips);
router.post('/', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), tripController.createTrip);
router.get('/:id', requirePermission('VIEW_TRIP'), tripController.getTrip);
router.put('/:id', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), tripController.updateTrip);
router.delete('/:id', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), tripController.deleteTrip);

module.exports = router;
