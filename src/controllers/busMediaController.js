const busMediaService = require('../services/busMediaService');

const listBusMedia = async (req, res, next) => {
  try {
    const result = await busMediaService.listBusMedia(req.params.busId, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getBusMedia = async (req, res, next) => {
  try {
    const result = await busMediaService.getBusMediaById(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createBusMedia = async (req, res, next) => {
  try {
    const result = await busMediaService.createBusMedia(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateBusMedia = async (req, res, next) => {
  try {
    const result = await busMediaService.updateBusMedia(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const deleteBusMedia = async (req, res, next) => {
  try {
    const result = await busMediaService.deleteBusMedia(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listBusMedia,
  getBusMedia,
  createBusMedia,
  updateBusMedia,
  deleteBusMedia,
};
