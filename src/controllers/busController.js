const busService = require('../services/busService');

const listBuses = async (req, res, next) => {
  try {
    const result = await busService.listBuses(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getBus = async (req, res, next) => {
  try {
    const result = await busService.getBusById(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createBus = async (req, res, next) => {
  try {
    const result = await busService.createBus(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateBus = async (req, res, next) => {
  try {
    const result = await busService.updateBus(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const deleteBus = async (req, res, next) => {
  try {
    const result = await busService.deleteBus(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { listBuses, getBus, createBus, updateBus, deleteBus };
