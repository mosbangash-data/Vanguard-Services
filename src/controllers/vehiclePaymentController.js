const vehiclePaymentService = require('../services/vehiclePaymentService');

const createVehiclePayment = async (req, res, next) => {
  try {
    const result = await vehiclePaymentService.createVehiclePayment(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const listVehiclePayments = async (req, res, next) => {
  try {
    const result = await vehiclePaymentService.listVehiclePayments(req.params.reservationId, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getVehiclePayment = async (req, res, next) => {
  try {
    const result = await vehiclePaymentService.getVehiclePayment(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateVehiclePayment = async (req, res, next) => {
  try {
    const result = await vehiclePaymentService.updateVehiclePayment(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const validateVehiclePayment = async (req, res, next) => {
  try {
    const result = await vehiclePaymentService.validateVehiclePayment(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const rejectVehiclePayment = async (req, res, next) => {
  try {
    const result = await vehiclePaymentService.rejectVehiclePayment(req.params.id, req.user, req.body?.reason);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const cancelVehiclePayment = async (req, res, next) => {
  try {
    const result = await vehiclePaymentService.cancelVehiclePayment(req.params.id, req.user, req.body?.reason);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createVehiclePayment,
  listVehiclePayments,
  getVehiclePayment,
  updateVehiclePayment,
  validateVehiclePayment,
  rejectVehiclePayment,
  cancelVehiclePayment,
};
