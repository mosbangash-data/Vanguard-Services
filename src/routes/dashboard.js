const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');

router.use(authenticateToken);

router.get('/overview', dashboardController.overview);

module.exports = router;

