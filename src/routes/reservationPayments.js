const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const reservationPaymentController = require('../controllers/reservationPaymentController');
const { validateReservationPaymentCreate, validateReservationPaymentUpdate } = require('../validators/reservationPaymentValidator');

router.use(authenticateToken);

router.get('/', requirePermission('VIEW_PAYMENT'), reservationPaymentController.listPendingReservationPayments);
router.post('/', requirePermission('MANAGE_RESERVATION_PAYMENT'), validateReservationPaymentCreate, reservationPaymentController.createReservationPayment);
router.get('/reservation/:reservationId', requirePermission('VIEW_RESERVATION'), reservationPaymentController.listReservationPayments);
router.get('/:id', requirePermission('VIEW_RESERVATION'), reservationPaymentController.getReservationPayment);
router.put('/:id', requirePermission('MANAGE_RESERVATION_PAYMENT'), validateReservationPaymentUpdate, reservationPaymentController.updateReservationPayment);
router.post('/:id/validate', requirePermission('MANAGE_RESERVATION_PAYMENT'), reservationPaymentController.validateReservationPayment);
router.post('/:id/reject', requirePermission('MANAGE_RESERVATION_PAYMENT'), reservationPaymentController.rejectReservationPayment);
router.post('/:id/cancel', requirePermission('MANAGE_RESERVATION_PAYMENT'), reservationPaymentController.cancelReservationPayment);

module.exports = router;
