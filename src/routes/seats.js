const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const seatController = require('../controllers/seatController');

router.use(authenticateToken);

router.get('/', seatController.listSeats);
router.get('/:busId', seatController.listSeats);
router.get('/:busId/:seatNumber', seatController.getSeat);

module.exports = router;
