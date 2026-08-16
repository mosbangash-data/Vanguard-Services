const parcelService = require('../services/parcelService');

const listParcels = async (req, res, next) => {
  try { const result = await parcelService.listParcels(req.query, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const getParcel = async (req, res, next) => {
  try { const result = await parcelService.getParcelById(req.params.id, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const createParcel = async (req, res, next) => {
  try { const result = await parcelService.createParcel(req.body, req.user); res.status(201).json({ success: true, data: result }); } catch (err) { next(err); }
};

const updateParcel = async (req, res, next) => {
  try { const result = await parcelService.updateParcel(req.params.id, req.body, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const deleteParcel = async (req, res, next) => {
  try { const result = await parcelService.deleteParcel(req.params.id, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

module.exports = { listParcels, getParcel, createParcel, updateParcel, deleteParcel };
