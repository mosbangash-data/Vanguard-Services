const reservationService = require('../services/reservationService');

const listReservations = async (req, res, next) => {
  try { const result = await reservationService.listReservations(req.query, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const getReservation = async (req, res, next) => {
  try { const result = await reservationService.getReservationById(req.params.id, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const createReservation = async (req, res, next) => {
  try { const result = await reservationService.createReservation(req.body, req.user); res.status(201).json({ success: true, data: result }); } catch (err) { next(err); }
};

const updateReservation = async (req, res, next) => {
  try { const result = await reservationService.updateReservation(req.params.id, req.body, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const cancelReservation = async (req, res, next) => {
  try { const result = await reservationService.cancelReservation(req.params.id, req.body, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const deleteReservation = async (req, res, next) => {
  try { const { AppError } = require('../middleware/errorHandler'); throw new AppError('Reservations cannot be deleted. Use POST /:id/cancel to preserve payment and ticket history.', 409); } catch (err) { next(err); }
};

module.exports = { listReservations, getReservation, createReservation, updateReservation, cancelReservation, deleteReservation };
