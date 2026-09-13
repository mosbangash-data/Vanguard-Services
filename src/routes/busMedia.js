const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole, requireAnyPermission } = require('../middleware/permissionMiddleware');
const busMediaController = require('../controllers/busMediaController');
const { validateBusMediaCreate, validateBusMediaUpdate } = require('../validators/busMediaValidator');

router.use(authenticateToken);

router.get('/bus/:busId', busMediaController.listBusMedia);
router.post('/', validateBusMediaCreate, busMediaController.createBusMedia);
router.get('/:id', busMediaController.getBusMedia);
router.put('/:id', validateBusMediaUpdate, busMediaController.updateBusMedia);
router.delete('/:id', busMediaController.deleteBusMedia);

module.exports = router;
