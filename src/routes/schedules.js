const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');
const scheduleController = require('../controllers/scheduleController');

router.use(authenticateToken);

router.get('/', scheduleController.listSchedules);
router.post('/', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), scheduleController.createSchedule);
router.get('/:id', scheduleController.getSchedule);
router.put('/:id', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), scheduleController.updateSchedule);
router.delete('/:id', requireRole('SUPER_ADMIN', 'SERVICE_ADMIN'), scheduleController.deleteSchedule);

module.exports = router;
