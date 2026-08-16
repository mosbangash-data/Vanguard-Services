const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const driverController = require('../controllers/driverController');

router.use(authenticateToken);

router.get('/', driverController.listDrivers);
router.post('/', driverController.createDriver);
router.get('/:id', driverController.getDriver);
router.put('/:id', driverController.updateDriver);
router.delete('/:id', driverController.deleteDriver);

module.exports = router;
