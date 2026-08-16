const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuthenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const vehicleController = require('../controllers/vehicleController');
const { validateVehicleCreate, validateVehicleUpdate } = require('../validators/vehicleValidator');

router.get('/', optionalAuthenticateToken, vehicleController.listPublicVehicles);
router.get('/:id', optionalAuthenticateToken, vehicleController.getPublicVehicle);

router.use(authenticateToken);

router.post('/', requirePermission('CREATE_VEHICLE'), validateVehicleCreate, vehicleController.createVehicle);
router.patch('/:id', requirePermission('UPDATE_VEHICLE'), validateVehicleUpdate, vehicleController.updateVehicle);
router.put('/:id', requirePermission('UPDATE_VEHICLE'), validateVehicleUpdate, vehicleController.updateVehicle);
router.delete('/:id', requirePermission('DELETE_VEHICLE'), vehicleController.deleteVehicle);

module.exports = router;
