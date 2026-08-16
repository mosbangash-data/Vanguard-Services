const express = require('express');
const router = express.Router();
const { optionalAuthenticateToken } = require('../middleware/authMiddleware');
const ticketController = require('../controllers/ticketController');

router.get('/:ticketCode', optionalAuthenticateToken, ticketController.getTicket);
router.get('/:ticketCode/print', optionalAuthenticateToken, ticketController.renderPublicTicketPrint);

module.exports = router;