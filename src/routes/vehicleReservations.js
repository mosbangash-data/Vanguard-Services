const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const vehicleReservationController = require('../controllers/vehicleReservationController');
const { validateVehicleReservationCreate, validateVehicleReservationUpdate } = require('../validators/vehicleReservationValidator');

router.use(authenticateToken);

router.get('/', requirePermission('VIEW_RESERVATION'), vehicleReservationController.listVehicleReservations);
router.post('/', requirePermission('MANAGE_VEHICLE_RESERVATION'), validateVehicleReservationCreate, vehicleReservationController.createVehicleReservation);
router.get('/:id', requirePermission('VIEW_RESERVATION'), vehicleReservationController.getVehicleReservation);
router.put('/:id', requirePermission('MANAGE_VEHICLE_RESERVATION'), validateVehicleReservationUpdate, vehicleReservationController.updateVehicleReservation);
router.post('/:id/cancel', requirePermission('CANCEL_VEHICLE_RESERVATION'), vehicleReservationController.cancelVehicleReservation);

module.exports = router;