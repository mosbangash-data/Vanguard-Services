const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');
const driverController = require('../controllers/driverController');

router.use(authenticateToken);

router.get('/', driverController.listDrivers);
router.post('/', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), driverController.createDriver);
router.get('/:id', driverController.getDriver);
router.put('/:id', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), driverController.updateDriver);
router.delete('/:id', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), driverController.deleteDriver);

module.exports = router;
