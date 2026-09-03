const parcelService = require('../services/parcelService');
const { calculateOfficialPrice } = require('../services/parcelPricingService');

const listParcels = async (req, res, next) => {
  try {
    const result = await parcelService.listParcels(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getParcel = async (req, res, next) => {
  try {
    const result = await parcelService.getParcelById(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const calculatePriceQuote = async (req, res, next) => {
  try {
    const result = await calculateOfficialPrice(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createParcel = async (req, res, next) => {
  try {
    const result = await parcelService.createParcel(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const payParcel = async (req, res, next) => {
  try {
    const result = await parcelService.payParcel(req.params.id, req.body, req.user);
    res.json({ success: true, message: 'Parcel payment processed', data: result });
  } catch (err) {
    next(err);
  }
};

const changeStatus = async (req, res, next) => {
  try {
    const result = await parcelService.changeParcelStatus(req.params.id, req.body, req.user);
    res.json({ success: true, message: 'Parcel status updated', data: result });
  } catch (err) {
    next(err);
  }
};

const collectParcel = async (req, res, next) => {
  try {
    const result = await parcelService.collectParcel(req.params.id, req.body, req.user);
    res.json({ success: true, message: 'Parcel collected successfully', data: result });
  } catch (err) {
    next(err);
  }
};

const getIdentityData = async (req, res, next) => {
  try {
    const result = await parcelService.getParcelIdentityData(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getReceipt = async (req, res, next) => {
  try {
    const result = await parcelService.getParcelReceiptContext(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const trackPublic = async (req, res, next) => {
  try {
    const result = await parcelService.trackPublicParcel(req.params.trackingCode);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateParcel = async (req, res, next) => {
  try {
    const result = await parcelService.updateParcel(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const deleteParcel = async (req, res, next) => {
  try {
    const result = await parcelService.deleteParcel(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listParcels,
  getParcel,
  calculatePriceQuote,
  createParcel,
  payParcel,
  changeStatus,
  collectParcel,
  getIdentityData,
  getReceipt,
  trackPublic,
  updateParcel,
  deleteParcel,
};

