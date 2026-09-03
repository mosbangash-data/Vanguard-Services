const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

router.post('/mbiyopay', webhookController.handleMbiyoPayWebhook);

module.exports = router;

