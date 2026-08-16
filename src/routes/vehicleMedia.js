const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const vehicleMediaController = require('../controllers/vehicleMediaController');
const { validateVehicleMediaCreate, validateVehicleMediaUpdate } = require('../validators/vehicleMediaValidator');

router.use(authenticateToken);

router.get('/vehicle/:vehicleId', requirePermission('MANAGE_VEHICLE_MEDIA'), vehicleMediaController.listVehicleMedia);
router.post('/', requirePermission('MANAGE_VEHICLE_MEDIA'), validateVehicleMediaCreate, vehicleMediaController.createVehicleMedia);
router.get('/:id', requirePermission('MANAGE_VEHICLE_MEDIA'), vehicleMediaController.getVehicleMedia);
router.put('/:id', requirePermission('MANAGE_VEHICLE_MEDIA'), validateVehicleMediaUpdate, vehicleMediaController.updateVehicleMedia);
router.delete('/:id', requirePermission('MANAGE_VEHICLE_MEDIA'), vehicleMediaController.deleteVehicleMedia);

module.exports = router;
