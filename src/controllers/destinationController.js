const destinationService = require('../services/destinationService');

const listDestinations = async (req, res, next) => {
  try { const result = await destinationService.listDestinations(req.query, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const getDestination = async (req, res, next) => {
  try { const result = await destinationService.getDestinationById(req.params.id, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const createDestination = async (req, res, next) => {
  try { const result = await destinationService.createDestination(req.body, req.user); res.status(201).json({ success: true, data: result }); } catch (err) { next(err); }
};

const updateDestination = async (req, res, next) => {
  try { const result = await destinationService.updateDestination(req.params.id, req.body, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const deleteDestination = async (req, res, next) => {
  try { const result = await destinationService.deleteDestination(req.params.id, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

module.exports = { listDestinations, getDestination, createDestination, updateDestination, deleteDestination };
