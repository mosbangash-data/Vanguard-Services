const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const scheduleController = require('../controllers/scheduleController');

router.use(authenticateToken);

router.get('/', scheduleController.listSchedules);
router.post('/', scheduleController.createSchedule);
router.get('/:id', scheduleController.getSchedule);
router.put('/:id', scheduleController.updateSchedule);
router.delete('/:id', scheduleController.deleteSchedule);

module.exports = router;
