const QRCode = require('qrcode');
const ticketService = require('../services/ticketService');

const buildQrSvg = async (value) => {
  try {
    return await QRCode.toString(value, {
      type: 'svg',
      width: 180,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    });
  } catch {
    // Fallback minimal if QR generation fails
    return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" fill="#ffffff"/><text x="90" y="90" text-anchor="middle" font-size="12" fill="#111827">QR Error</text></svg>`;
  }
};

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
    const ticket = await ticketService.getTicketByCode(req.params.ticketCode);
    res.json({ success: true, data: { ticket } });
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
    const { ticket, currency } = await ticketService.getTicketPrintContext(req.params.ticketCode, req.user?.id || null);

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
    });
  } catch (err) {
    next(err);
  }
};

const renderPublicTicketPrint = async (req, res, next) => {
  try {
    const { ticket, currency } = await ticketService.getTicketPrintContext(req.params.ticketCode, req.user?.id || null);
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
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createTicket, listTickets, listTicketScans, getTicket, scanTicket, cancelTicket, renderTicketPrint, renderPublicTicketPrint };
