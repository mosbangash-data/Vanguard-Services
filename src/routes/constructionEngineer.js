const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const constructionController = require('../controllers/constructionController');

router.use(authenticateToken);
router.get('/projects', requirePermission('VIEW_PROJECT'), constructionController.listEngineerProjects);

module.exports = router;
