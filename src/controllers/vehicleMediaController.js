const vehicleMediaService = require('../services/vehicleMediaService');

const listVehicleMedia = async (req, res, next) => {
  try {
    const result = await vehicleMediaService.listVehicleMedia(req.params.vehicleId, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getVehicleMedia = async (req, res, next) => {
  try {
    const result = await vehicleMediaService.getVehicleMediaById(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createVehicleMedia = async (req, res, next) => {
  try {
    const result = await vehicleMediaService.createVehicleMedia(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateVehicleMedia = async (req, res, next) => {
  try {
    const result = await vehicleMediaService.updateVehicleMedia(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const deleteVehicleMedia = async (req, res, next) => {
  try {
    const result = await vehicleMediaService.deleteVehicleMedia(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listVehicleMedia,
  getVehicleMedia,
  createVehicleMedia,
  updateVehicleMedia,
  deleteVehicleMedia,
};
