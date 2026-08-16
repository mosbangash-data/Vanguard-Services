const notificationService = require('../services/notificationService');

const listNotifications = async (req, res, next) => {
  try { const result = await notificationService.listNotifications(req.query, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const createNotification = async (req, res, next) => {
  try { const result = await notificationService.createNotification(req.body, req.user); res.status(201).json({ success: true, data: result }); } catch (err) { next(err); }
};

const markRead = async (req, res, next) => {
  try { const result = await notificationService.markRead(req.params.id, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

module.exports = { listNotifications, createNotification, markRead };
