const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const vehicleMediaController = require('../controllers/vehicleMediaController');
const { validateVehicleMediaCreate, validateVehicleMediaUpdate } = require('../validators/vehicleMediaValidator');
const mediaService = require('../services/mediaService');
const { AppError } = require('../middleware/errorHandler');
const { parseMultipart } = require('../middleware/uploadMiddleware');

router.use(authenticateToken);

router.get('/vehicle/:vehicleId', requirePermission('MANAGE_VEHICLE_MEDIA'), vehicleMediaController.listVehicleMedia);
router.post('/', requirePermission('MANAGE_VEHICLE_MEDIA'), validateVehicleMediaCreate, vehicleMediaController.createVehicleMedia);
router.post('/vehicle/:vehicleId/media', requirePermission('MANAGE_VEHICLE_MEDIA'), parseMultipart, async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);
    if (!files.length) throw new AppError('No file uploaded', 400);

    const result = await mediaService.uploadVehicleMedia({
      vehicleId: req.params.vehicleId,
      files,
      user: req.user,
      isPrimary: req.body?.isPrimary === 'true' || req.body?.isPrimary === true,
      order: req.body?.order !== undefined ? Number(req.body.order) : 0,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
router.get('/:id', requirePermission('MANAGE_VEHICLE_MEDIA'), vehicleMediaController.getVehicleMedia);
router.put('/:id', requirePermission('MANAGE_VEHICLE_MEDIA'), validateVehicleMediaUpdate, vehicleMediaController.updateVehicleMedia);
router.delete('/:id', requirePermission('MANAGE_VEHICLE_MEDIA'), vehicleMediaController.deleteVehicleMedia);

module.exports = router;
