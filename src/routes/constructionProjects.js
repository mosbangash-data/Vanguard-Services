const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const constructionController = require('../controllers/constructionController');
const { validateProjectCreate, validateProjectUpdate } = require('../validators/constructionValidator');

router.use(authenticateToken);

router.get('/', requirePermission('VIEW_PROJECT'), constructionController.listProjects);
router.post('/', requirePermission('CREATE_PROJECT'), validateProjectCreate, constructionController.createProject);
router.get('/:id', requirePermission('VIEW_PROJECT'), constructionController.getProject);
router.put('/:id', requirePermission('UPDATE_PROJECT'), validateProjectUpdate, constructionController.updateProject);
router.delete('/:id', requirePermission('DELETE_PROJECT'), constructionController.deleteProject);

module.exports = router;
