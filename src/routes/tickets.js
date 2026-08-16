const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const ticketController = require('../controllers/ticketController');

router.use(authenticateToken);

router.get('/', requirePermission('VIEW_RESERVATION'), ticketController.listTickets);
router.get('/scans', requirePermission('VIEW_TICKET_SCAN'), ticketController.listTicketScans);
router.post('/', requirePermission('VIEW_RESERVATION'), ticketController.createTicket);
router.get('/:ticketCode', requirePermission('VIEW_RESERVATION'), ticketController.getTicket);
router.post('/scan', requirePermission('SCAN_TICKET'), ticketController.scanTicket);
router.patch('/:ticketCode/cancel', requirePermission('VIEW_RESERVATION'), ticketController.cancelTicket);
router.get('/:ticketCode/print', requirePermission('VIEW_RESERVATION'), ticketController.renderTicketPrint);

module.exports = router;
