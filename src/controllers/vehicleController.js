const vehicleService = require('../services/vehicleService');

const listPublicVehicles = async (req, res, next) => {
  try {
    const result = await vehicleService.listPublicVehicles(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getPublicVehicle = async (req, res, next) => {
  try {
    const result = await vehicleService.getPublicVehicle(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createVehicle = async (req, res, next) => {
  try {
    const result = await vehicleService.createVehicle(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateVehicle = async (req, res, next) => {
  try {
    const result = await vehicleService.updateVehicle(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const deleteVehicle = async (req, res, next) => {
  try {
    const result = await vehicleService.deleteVehicle(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { listPublicVehicles, getPublicVehicle, createVehicle, updateVehicle, deleteVehicle };
