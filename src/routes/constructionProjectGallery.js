const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const constructionController = require('../controllers/constructionController');
const { validateProjectGalleryCreate, validateProjectGalleryUpdate, validateProjectGallerySetPrimary } = require('../validators/constructionValidator');

router.use(authenticateToken);

// List and create gallery items for a project
router.get('/', requirePermission('VIEW_PROJECT'), constructionController.listProjectGallery);
router.post('/', requirePermission('CREATE_PROJECT'), validateProjectGalleryCreate, constructionController.createProjectGallery);

// Single gallery operations
router.get('/:id', requirePermission('VIEW_PROJECT'), constructionController.getProjectGallery);
router.put('/:id', requirePermission('UPDATE_PROJECT'), validateProjectGalleryUpdate, constructionController.updateProjectGallery);
router.delete('/:id', requirePermission('DELETE_PROJECT'), constructionController.deleteProjectGallery);

// Set primary media for a project
router.post('/:id/set-primary', requirePermission('UPDATE_PROJECT'), validateProjectGallerySetPrimary, constructionController.setPrimaryProjectGallery);

module.exports = router;
