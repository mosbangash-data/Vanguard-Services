const vehicleInquiryService = require('../services/vehicleInquiryService');

const listVehicleInquiries = async (req, res, next) => {
  try {
    const result = await vehicleInquiryService.listVehicleInquiries(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getVehicleInquiry = async (req, res, next) => {
  try {
    const result = await vehicleInquiryService.getVehicleInquiryById(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createVehicleInquiry = async (req, res, next) => {
  try {
    const result = await vehicleInquiryService.createVehicleInquiry(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateVehicleInquiry = async (req, res, next) => {
  try {
    const result = await vehicleInquiryService.updateVehicleInquiry(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const assignVehicleInquiry = async (req, res, next) => {
  try {
    const result = await vehicleInquiryService.assignVehicleInquiry(req.params.id, req.body?.assignedToUserId, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listVehicleInquiries,
  getVehicleInquiry,
  createVehicleInquiry,
  updateVehicleInquiry,
  assignVehicleInquiry,
};
