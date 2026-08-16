const driverService = require('../services/driverService');

const listDrivers = async (req, res, next) => {
  try {
    const result = await driverService.listDrivers(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const getDriver = async (req, res, next) => {
  try { const result = await driverService.getDriverById(req.params.id, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const createDriver = async (req, res, next) => {
  try { const result = await driverService.createDriver(req.body, req.user); res.status(201).json({ success: true, data: result }); } catch (err) { next(err); }
};

const updateDriver = async (req, res, next) => {
  try { const result = await driverService.updateDriver(req.params.id, req.body, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

const deleteDriver = async (req, res, next) => {
  try { const result = await driverService.deleteDriver(req.params.id, req.user); res.json({ success: true, data: result }); } catch (err) { next(err); }
};

module.exports = { listDrivers, getDriver, createDriver, updateDriver, deleteDriver };
