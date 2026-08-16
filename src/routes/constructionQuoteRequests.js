const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const constructionController = require('../controllers/constructionController');
const { validateQuoteRequestCreate, validateQuoteRequestUpdate } = require('../validators/constructionValidator');

router.use(authenticateToken);

router.get('/', requirePermission('VIEW_QUOTE_REQUEST'), constructionController.listQuoteRequests);
router.post('/', requirePermission('CREATE_QUOTE_REQUEST'), validateQuoteRequestCreate, constructionController.createQuoteRequest);
router.get('/:id', requirePermission('VIEW_QUOTE_REQUEST'), constructionController.getQuoteRequest);
router.put('/:id', requirePermission('UPDATE_QUOTE_REQUEST'), validateQuoteRequestUpdate, constructionController.updateQuoteRequest);

module.exports = router;