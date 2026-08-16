const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const reservationController = require('../controllers/reservationController');

router.use(authenticateToken);

router.get('/', reservationController.listReservations);
router.post('/', reservationController.createReservation);
router.get('/:id', reservationController.getReservation);
router.put('/:id', reservationController.updateReservation);
router.delete('/:id', reservationController.deleteReservation);

module.exports = router;
