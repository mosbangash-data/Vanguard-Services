const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const constructionController = require('../controllers/constructionController');
const { validateCustomerRequestCreate, validateCustomerRequestUpdate } = require('../validators/constructionValidator');

router.use(authenticateToken);

router.get('/', requirePermission('VIEW_CUSTOMER_REQUEST'), constructionController.listCustomerRequests);
router.post('/', requirePermission('CREATE_CUSTOMER_REQUEST'), validateCustomerRequestCreate, constructionController.createCustomerRequest);
router.get('/:id', requirePermission('VIEW_CUSTOMER_REQUEST'), constructionController.getCustomerRequest);
router.put('/:id', requirePermission('UPDATE_CUSTOMER_REQUEST'), validateCustomerRequestUpdate, constructionController.updateCustomerRequest);

module.exports = router;