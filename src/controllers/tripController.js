const tripService = require('../services/tripService');

const listTrips = async (req, res, next) => {
  try { const result = await tripService.listTrips(req.query, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const getTrip = async (req, res, next) => {
  try { const result = await tripService.getTripById(req.params.id, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const createTrip = async (req, res, next) => {
  try { const result = await tripService.createTrip(req.body, req.user); res.status(201).json({ success: true, data: result }); } catch (err) { next(err); }
};

const updateTrip = async (req, res, next) => {
  try { const result = await tripService.updateTrip(req.params.id, req.body, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const deleteTrip = async (req, res, next) => {
  try { const result = await tripService.deleteTrip(req.params.id, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

module.exports = { listTrips, getTrip, createTrip, updateTrip, deleteTrip };
