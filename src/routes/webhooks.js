const express = require('express');
const router = express.Router();
const mbiyoPayService = require('../services/mbiyoPayService');

router.post('/mbiyopay', async (req, res, next) => {
  try {
    const result = await mbiyoPayService.handleWebhook(req);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

