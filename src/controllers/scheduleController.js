const scheduleService = require('../services/scheduleService');

const listSchedules = async (req, res, next) => {
  try { const result = await scheduleService.listSchedules(req.query, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const getSchedule = async (req, res, next) => {
  try { const result = await scheduleService.getScheduleById(req.params.id, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const createSchedule = async (req, res, next) => {
  try { const result = await scheduleService.createSchedule(req.body, req.user); res.status(201).json({ success: true, data: result }); } catch (err) { next(err); }
};

const updateSchedule = async (req, res, next) => {
  try { const result = await scheduleService.updateSchedule(req.params.id, req.body, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const deleteSchedule = async (req, res, next) => {
  try { const result = await scheduleService.deleteSchedule(req.params.id, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

module.exports = { listSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule };
