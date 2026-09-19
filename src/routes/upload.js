const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { parseMultipart } = require('../middleware/uploadMiddleware');
const mediaService = require('../services/mediaService');
const { AppError } = require('../middleware/errorHandler');
const { GENERAL_ENTITY_ID } = require('../config/media');

router.use(authenticateToken);

router.post('/', parseMultipart, async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);
    if (files.length === 0) {
      throw new AppError('No file uploaded', 400);
    }

    const payload = {
      entityType: req.body?.entityType || 'general',
      entityId: req.body?.entityId || GENERAL_ENTITY_ID,
      uploadedById: req.user.id,
      user: req.user,
      files,
      isPrimary: req.body?.isPrimary === 'true' || req.body?.isPrimary === true,
      order: req.body?.order !== undefined ? Number(req.body.order) : 0,
    };

    const result = await mediaService.uploadAndLinkFiles(payload);
    const media = result.items.length === 1 ? result.items[0] : result.items;

    res.status(201).json({
      success: true,
      data: {
        media,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
