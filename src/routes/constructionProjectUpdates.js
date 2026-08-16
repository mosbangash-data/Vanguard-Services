const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission, requireAnyPermission } = require('../middleware/permissionMiddleware');
const constructionController = require('../controllers/constructionController');
const { validateProjectUpdateCreate, validateProjectUpdateUpdate } = require('../validators/constructionValidator');

router.use(authenticateToken);

// List and create updates for a project
router.get('/', requirePermission('VIEW_PROJECT'), constructionController.listProjectUpdates);
router.post('/', requireAnyPermission('CREATE_PROJECT', 'CREATE_PROJECT_UPDATE'), validateProjectUpdateCreate, constructionController.createProjectUpdate);

// Single update operations (id in URL)
router.get('/:id', requirePermission('VIEW_PROJECT'), constructionController.getProjectUpdate);
router.put('/:id', requirePermission('UPDATE_PROJECT'), validateProjectUpdateUpdate, constructionController.updateProjectUpdate);
router.delete('/:id', requirePermission('DELETE_PROJECT'), constructionController.deleteProjectUpdate);

module.exports = router;
