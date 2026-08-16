const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const parcelController = require('../controllers/parcelController');

router.use(authenticateToken);

router.get('/', parcelController.listParcels);
router.post('/', parcelController.createParcel);
router.get('/:id', parcelController.getParcel);
router.put('/:id', parcelController.updateParcel);
router.delete('/:id', parcelController.deleteParcel);

module.exports = router;
