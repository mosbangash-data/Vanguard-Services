const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { parseMultipart } = require('../middleware/uploadMiddleware');
const mediaService = require('../services/mediaService');
const { AppError } = require('../middleware/errorHandler');

router.use(authenticateToken);

router.post('/', parseMultipart, async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);
    if (files.length === 0) {
      throw new AppError('No file uploaded', 400);
    }

    const payload = {
      department: req.body?.department || req.body?.departmentType || null,
      entityType: req.body?.entityType || 'general',
      entityId: req.body?.entityId || req.user.id,
      uploadedById: req.user.id,
      files,
      isPrimary: req.body?.isPrimary === 'true' || req.body?.isPrimary === true,
      order: req.body?.order !== undefined ? Number(req.body.order) : 0,
    };

    const result = await mediaService.uploadAndLinkFiles(payload);
    const [first] = result.items || [];

    res.status(201).json({
      success: true,
      data: {
        items: result.items,
        media: result.items,
        file: first || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
