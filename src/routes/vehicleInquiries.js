const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const vehicleInquiryController = require('../controllers/vehicleInquiryController');
const { validateVehicleInquiryCreate, validateVehicleInquiryUpdate } = require('../validators/vehicleInquiryValidator');

router.use(authenticateToken);

router.post('/', requirePermission('CREATE_VEHICLE_INQUIRY'), validateVehicleInquiryCreate, vehicleInquiryController.createVehicleInquiry);
router.get('/', requirePermission('VIEW_VEHICLE_INQUIRY'), vehicleInquiryController.listVehicleInquiries);
router.get('/:id', requirePermission('VIEW_VEHICLE_INQUIRY'), vehicleInquiryController.getVehicleInquiry);
router.patch('/:id/assign', requirePermission('ASSIGN_VEHICLE_INQUIRY'), vehicleInquiryController.assignVehicleInquiry);
router.patch('/:id', requirePermission('UPDATE_VEHICLE_INQUIRY'), validateVehicleInquiryUpdate, vehicleInquiryController.updateVehicleInquiry);
router.put('/:id', requirePermission('UPDATE_VEHICLE_INQUIRY'), validateVehicleInquiryUpdate, vehicleInquiryController.updateVehicleInquiry);

module.exports = router;
