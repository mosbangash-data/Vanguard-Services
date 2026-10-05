const QRCode = require('qrcode');
const ticketService = require('../services/ticketService');

const buildQrSvg = (value) => QRCode.toString(value, {
  type: 'svg',
  width: 240,
  margin: 3,
  errorCorrectionLevel: 'Q',
  color: {
    dark: '#111827',
    light: '#ffffff',
  },
});

const createTicket = async (req, res, next) => {
  try {
    const result = await ticketService.createTicketForReservation(req.body.reservationId, req.user);
    res.status(result.created ? 201 : 200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const listTickets = async (req, res, next) => {
  try {
    const result = await ticketService.listTickets(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const listTicketScans = async (req, res, next) => {
  try {
    const result = await ticketService.listTicketScans(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getTicket = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    const result = req.user
      ? { ticket: await ticketService.getTicketByCode(req.params.ticketCode, req.user) }
      : await ticketService.getPublicTicketByCode(req.params.ticketCode);
    // The authenticated API route is permission protected and agency scoped.
    // Render the QR from the ticket's stored signed payload; do not sign or
    // invent another ticket payload in the client.
    if (req.user && req.baseUrl === '/api/tickets') {
      result.ticket.qrDataUrl = await QRCode.toDataURL(result.ticket.qrCode, {
        width: 240,
        margin: 3,
        errorCorrectionLevel: 'Q',
        color: { dark: '#111827', light: '#ffffff' },
      });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const scanTicket = async (req, res, next) => {
  try {
    const result = await ticketService.scanTicketByQrCode(req.body?.qrCode || req.body?.ticketCode, req.user);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const cancelTicket = async (req, res, next) => {
  try {
    const result = await ticketService.cancelTicketByCode(req.params.ticketCode, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const renderTicketPrint = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    const printFormat = ['58mm', '80mm', '110mm', 'a4'].includes(req.query.format) ? req.query.format : '80mm';
    const { ticket, currency } = await ticketService.getTicketPrintContext(req.params.ticketCode, req.user?.id || null, req.user, { format: printFormat });

    const route = ticket.reservation.trip.schedule.route;
    const trip = ticket.reservation.trip;
    const schedule = trip.schedule;
    const reservation = ticket.reservation;

    const qrSvg = await buildQrSvg(ticket.qrCode);

    const printableTicket = {
      ...ticket,
      routeCode: route.code,
      departureCity: route.departureCity,
      arrivalCity: route.arrivalCity,
      departureTime: schedule.departureTime,
      returnTime: schedule.returnTime,
      departureAt: trip.departureAt,
      arrivalAt: trip.arrivalAt,
      bus: schedule.bus,
      reservationCode: reservation.reservationCode,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      customerEmail: reservation.customerEmail,
      seatNumber: reservation.seatNumber,
      totalAmount: reservation.totalAmount,
      tripStatus: reservation.status,
      qrSvg,
    };

    res.render('pages/ticket-print', {
      title: `Billet ${ticket.ticketCode}`,
      ticket: printableTicket,
      printType: 'print',
      appName: 'Vanguard Coach',
      currency,
      printFormat,
    });
  } catch (err) {
    next(err);
  }
};

const renderPublicTicketPrint = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    const printFormat = ['58mm', '80mm', '110mm', 'a4'].includes(req.query.format) ? req.query.format : '80mm';
    const { ticket, currency } = await ticketService.getTicketPrintContext(req.params.ticketCode, req.user?.id || null, req.user, { format: printFormat });
    const route = ticket.reservation.trip.schedule.route;
    const trip = ticket.reservation.trip;
    const schedule = trip.schedule;
    const reservation = ticket.reservation;

    const qrSvg = await buildQrSvg(ticket.qrCode);

    const printableTicket = {
      ...ticket,
      routeCode: route.code,
      departureCity: route.departureCity,
      arrivalCity: route.arrivalCity,
      departureTime: schedule.departureTime,
      returnTime: schedule.returnTime,
      departureAt: trip.departureAt,
      arrivalAt: trip.arrivalAt,
      bus: schedule.bus,
      reservationCode: reservation.reservationCode,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      customerEmail: reservation.customerEmail,
      seatNumber: reservation.seatNumber,
      totalAmount: reservation.totalAmount,
      tripStatus: reservation.status,
      qrSvg,
    };

    res.render('pages/ticket-print', {
      title: `Billet ${ticket.ticketCode}`,
      ticket: printableTicket,
      printType: 'print',
      appName: 'Vanguard Coach',
      currency,
      printFormat,
    });
  } catch (err) {
    next(err);
  }
};

const recordPublicTicketPrint = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    const format = ['58mm', '80mm', '110mm', 'a4'].includes(req.body?.format) ? req.body.format : '80mm';
    const printType = await ticketService.recordPublicTicketPrint(req.params.ticketCode, { format });
    res.json({ success: true, data: { printType } });
  } catch (err) {
    next(err);
  }
};

module.exports = { createTicket, listTickets, listTicketScans, getTicket, scanTicket, cancelTicket, renderTicketPrint, renderPublicTicketPrint, recordPublicTicketPrint };
