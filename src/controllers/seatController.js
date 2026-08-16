const seatService = require('../services/seatService');

const listSeats = async (req, res, next) => {
  try { const result = await seatService.listSeatsForBus(req.query.busId || req.params.busId, req.query.tripId, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const getSeat = async (req, res, next) => {
  try { const result = await seatService.getSeat(req.params.busId || req.query.busId, req.params.seatNumber || req.query.seatNumber, req.query.tripId, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

module.exports = { listSeats, getSeat };
