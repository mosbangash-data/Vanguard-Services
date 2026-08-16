const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const vehiclePaymentController = require('../controllers/vehiclePaymentController');
const { validateVehiclePaymentCreate, validateVehiclePaymentUpdate } = require('../validators/vehiclePaymentValidator');

router.use(authenticateToken);

router.post('/', requirePermission('MANAGE_VEHICLE_RESERVATION'), validateVehiclePaymentCreate, vehiclePaymentController.createVehiclePayment);
router.get('/reservation/:reservationId', requirePermission('VIEW_RESERVATION'), vehiclePaymentController.listVehiclePayments);
router.get('/:id', requirePermission('VIEW_RESERVATION'), vehiclePaymentController.getVehiclePayment);
router.put('/:id', requirePermission('MANAGE_VEHICLE_RESERVATION'), validateVehiclePaymentUpdate, vehiclePaymentController.updateVehiclePayment);
router.post('/:id/validate', requirePermission('MANAGE_VEHICLE_RESERVATION'), vehiclePaymentController.validateVehiclePayment);
router.post('/:id/reject', requirePermission('MANAGE_VEHICLE_RESERVATION'), vehiclePaymentController.rejectVehiclePayment);
router.post('/:id/cancel', requirePermission('MANAGE_VEHICLE_RESERVATION'), vehiclePaymentController.cancelVehiclePayment);

module.exports = router;
