const vehicleReservationService = require('../services/vehicleReservationService');

const listVehicleReservations = async (req, res, next) => {
  try {
    const result = await vehicleReservationService.listVehicleReservations(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getVehicleReservation = async (req, res, next) => {
  try {
    const result = await vehicleReservationService.getVehicleReservationById(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createVehicleReservation = async (req, res, next) => {
  try {
    const result = await vehicleReservationService.createVehicleReservation(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateVehicleReservation = async (req, res, next) => {
  try {
    const result = await vehicleReservationService.updateVehicleReservation(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const cancelVehicleReservation = async (req, res, next) => {
  try {
    const result = await vehicleReservationService.cancelVehicleReservation(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listVehicleReservations,
  getVehicleReservation,
  createVehicleReservation,
  updateVehicleReservation,
  cancelVehicleReservation,
};