const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { parseMultipart } = require('../middleware/uploadMiddleware');
const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

router.use(authenticateToken);

router.post('/', parseMultipart, async (req, res, next) => {
  try {
    const file = req.file || (req.files && req.files[0]);
    if (!file) {
      throw new AppError('No file uploaded', 400);
    }

    const entityType = typeof req.body?.entityType === 'string' ? req.body.entityType.trim() : 'general';
    const entityId = typeof req.body?.entityId === 'string' ? req.body.entityId.trim() : req.user.id;

    const media = await prisma.media.create({
      data: {
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: file.url,
        entityType,
        entityId,
        uploadedById: req.user.id,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        media,
        file: {
          url: file.url,
          fileName: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
