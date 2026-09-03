const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission, requireRole } = require('../middleware/permissionMiddleware');
const parcelController = require('../controllers/parcelController');
const { validateCreate, validatePickup, validateStatusChange } = require('../validators/parcelValidator');

// Public tracking and quote estimation
router.get('/track/:trackingCode', parcelController.trackPublic);
router.post('/quote', parcelController.calculatePriceQuote);

router.use(authenticateToken);

router.get('/', requirePermission('VIEW_PARCEL'), parcelController.listParcels);
router.post('/', requirePermission('CREATE_PARCEL'), validateCreate, parcelController.createParcel);
router.get('/:id', requirePermission('VIEW_PARCEL'), parcelController.getParcel);
router.put('/:id', requirePermission('UPDATE_PARCEL'), parcelController.updateParcel);
router.delete('/:id', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), parcelController.deleteParcel);

router.post('/:id/pay', requirePermission('VERIFY_PARCEL_PAYMENT'), parcelController.payParcel);
router.patch('/:id/status', requirePermission('CHANGE_PARCEL_STATUS'), validateStatusChange, parcelController.changeStatus);
router.post('/:id/collect', requirePermission('COLLECT_PARCEL'), validatePickup, parcelController.collectParcel);
router.get('/:id/receipt', requirePermission('PRINT_PARCEL_RECEIPT'), parcelController.getReceipt);
router.get('/:id/history', requirePermission('VIEW_PARCEL'), parcelController.getParcel);
router.get('/:id/identity', requirePermission('VIEW_IDENTITY_DATA'), parcelController.getIdentityData);

module.exports = router;

