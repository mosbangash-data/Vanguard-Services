const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/managerDashboardController');
const staffController = require('../controllers/agencyStaffController');
const cashClosureRoutes = require('./cashClosures');

router.use(authenticateToken);
router.get('/dashboard', requireRole('MANAGER', 'SERVICE_ADMIN'), controller.getManagerDashboard);
router.use('/cash-closures', cashClosureRoutes);
router.get('/staff', requireRole('MANAGER'), staffController.list);
router.post('/staff', requireRole('MANAGER'), staffController.create);
router.get('/staff/:id', requireRole('MANAGER'), staffController.get);
router.patch('/staff/:id', requireRole('MANAGER'), staffController.update);
router.patch('/staff/:id/status', requireRole('MANAGER'), staffController.updateStatus);
router.get('/staff/:id/attendance', requireRole('MANAGER'), staffController.listAttendance);
router.put('/staff/:id/attendance', requireRole('MANAGER'), staffController.upsertAttendance);

module.exports = router;
