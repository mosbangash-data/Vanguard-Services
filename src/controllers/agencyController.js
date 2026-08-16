const agencyService = require('../services/agencyService');

const listAgencies = async (req, res, next) => {
  try {
    const result = await agencyService.listAgencies(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getAgency = async (req, res, next) => {
  try {
    const result = await agencyService.getAgencyById(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createAgency = async (req, res, next) => {
  try {
    const result = await agencyService.createAgency(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateAgency = async (req, res, next) => {
  try {
    const result = await agencyService.updateAgency(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const deleteAgency = async (req, res, next) => {
  try {
    const result = await agencyService.deleteAgency(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listAgencies,
  getAgency,
  createAgency,
  updateAgency,
  deleteAgency,
};
