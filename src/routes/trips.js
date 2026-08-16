const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const tripController = require('../controllers/tripController');

router.use(authenticateToken);

router.get('/', tripController.listTrips);
router.post('/', tripController.createTrip);
router.get('/:id', tripController.getTrip);
router.put('/:id', tripController.updateTrip);
router.delete('/:id', tripController.deleteTrip);

module.exports = router;
