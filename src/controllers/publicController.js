const publicTransportService = require('../services/publicTransportService');
const publicConstructionService = require('../services/publicConstructionService');
const publicAutomobileService = require('../services/publicAutomobileService');
const publicWebsiteService = require('../services/publicWebsiteService');

// ===== TRANSPORT PUBLIC =====

const listPublicTrips = async (req, res, next) => {
  try {
    const result = await publicTransportService.listPublicTrips(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getPublicTripSeats = async (req, res, next) => {
  try {
    const result = await publicTransportService.getPublicTripSeats(req.params.tripId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createPublicReservation = async (req, res, next) => {
  try {
    const result = await publicTransportService.createPublicReservation(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getPublicReservationByCode = async (req, res, next) => {
  try {
    const result = await publicTransportService.getPublicReservationByCode(req.params.code);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createPublicReservationPayment = async (req, res, next) => {
  try {
    const result = await publicTransportService.createPublicReservationPayment(req.params.reservationId, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// ===== CONSTRUCTION PUBLIC =====

const listPublicProjects = async (req, res, next) => {
  try {
    const result = await publicConstructionService.listPublicProjects(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getPublicProject = async (req, res, next) => {
  try {
    const result = await publicConstructionService.getPublicProject(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createPublicCustomerRequest = async (req, res, next) => {
  try {
    const result = await publicConstructionService.createPublicCustomerRequest(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createPublicQuoteRequest = async (req, res, next) => {
  try {
    const result = await publicConstructionService.createPublicQuoteRequest(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// ===== AUTOMOBILE PUBLIC =====

const createPublicVehicleInquiry = async (req, res, next) => {
  try {
    const result = await publicAutomobileService.createPublicVehicleInquiry(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// ===== WEBSITE SETTINGS PUBLIC =====

const getPublicWebsiteSettings = async (req, res, next) => {
  try {
    const result = await publicWebsiteService.getPublicWebsiteSettings();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listPublicTrips,
  getPublicTripSeats,
  createPublicReservation,
  getPublicReservationByCode,
  createPublicReservationPayment,
  listPublicProjects,
  getPublicProject,
  createPublicCustomerRequest,
  createPublicQuoteRequest,
  createPublicVehicleInquiry,
  getPublicWebsiteSettings,
};