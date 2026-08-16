const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const destinationController = require('../controllers/destinationController');

router.use(authenticateToken);

router.get('/', destinationController.listDestinations);
router.post('/', destinationController.createDestination);
router.get('/:id', destinationController.getDestination);
router.put('/:id', destinationController.updateDestination);
router.delete('/:id', destinationController.deleteDestination);

module.exports = router;
