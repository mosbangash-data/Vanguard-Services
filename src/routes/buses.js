const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const busController = require('../controllers/busController');

router.use(authenticateToken);

router.get('/', busController.listBuses);
router.post('/', busController.createBus);
router.get('/:id', busController.getBus);
router.put('/:id', busController.updateBus);
router.delete('/:id', busController.deleteBus);

module.exports = router;
