const adminMediaService = require('../services/adminMediaService');

const createMedia = async (req, res, next) => {
  try {
    const result = await adminMediaService.createMedia(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { createMedia };
