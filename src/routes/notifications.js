const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.use(authenticateToken);

router.get('/', notificationController.listNotifications);
router.post('/', notificationController.createNotification);
router.put('/:id/read', notificationController.markRead);

module.exports = router;
