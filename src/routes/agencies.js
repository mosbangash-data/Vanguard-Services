const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const agencyController = require('../controllers/agencyController');

router.use(authenticateToken);

router.get('/', agencyController.listAgencies);
router.post('/', agencyController.createAgency);
router.get('/:id', agencyController.getAgency);
router.put('/:id', agencyController.updateAgency);
router.delete('/:id', agencyController.deleteAgency);

module.exports = router;
