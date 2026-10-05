const express = require('express');
const router = express.Router();
const { optionalAuthenticateToken, authenticateToken } = require('../middleware/authMiddleware');
const ticketController = require('../controllers/ticketController');

router.get('/:ticketCode', optionalAuthenticateToken, ticketController.getTicket);
router.get('/:ticketCode/print', authenticateToken, ticketController.renderPublicTicketPrint);
router.post('/:ticketCode/print-event', ticketController.recordPublicTicketPrint);

module.exports = router;
