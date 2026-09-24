const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const publicController = require('../controllers/publicController');
const {
  validatePublicReservationCreate,
  validatePublicReservationPaymentCreate,
  validatePublicCustomerRequestCreate,
  validatePublicQuoteRequestCreate,
  validatePublicVehicleInquiryCreate,
} = require('../validators/publicValidator');

// Rate limiting ciblé pour les endpoints publics POST (prévention de spam/abus)
const publicPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});

const setNoStoreHeaders = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

// ===== TRANSPORT PUBLIC =====

// GET /api/public/agencies
router.get('/agencies', setNoStoreHeaders, publicController.listPublicAgencies);

// GET /api/public/trips?departure=&arrival=&date=&page=&limit=
router.get('/trips', setNoStoreHeaders, publicController.listPublicTrips);

// GET /api/public/trips/:tripId/seats
router.get('/trips/:tripId/seats', setNoStoreHeaders, publicController.getPublicTripSeats);

// POST /api/public/reservations
router.post('/reservations', publicPostLimiter, validatePublicReservationCreate, publicController.createPublicReservation);

// GET /api/public/reservations/:code
router.get('/reservations/:code', publicController.getPublicReservationByCode);

// POST /api/public/reservations/:reservationId/payments
router.post(
  '/reservations/:reservationId/payments',
  publicPostLimiter,
  validatePublicReservationPaymentCreate,
  publicController.createPublicReservationPayment
);

// ===== CONSTRUCTION PUBLIC =====

// GET /api/public/construction/projects?page=&limit=
router.get('/construction/projects', publicController.listPublicProjects);

// GET /api/public/construction/projects/:id
router.get('/construction/projects/:id', publicController.getPublicProject);

// POST /api/public/construction/customer-requests
router.post(
  '/construction/customer-requests',
  publicPostLimiter,
  validatePublicCustomerRequestCreate,
  publicController.createPublicCustomerRequest
);

// POST /api/public/construction/quote-requests
router.post(
  '/construction/quote-requests',
  publicPostLimiter,
  validatePublicQuoteRequestCreate,
  publicController.createPublicQuoteRequest
);

// ===== AUTOMOBILE PUBLIC =====

// POST /api/public/vehicle-inquiries
router.post(
  '/vehicle-inquiries',
  publicPostLimiter,
  validatePublicVehicleInquiryCreate,
  publicController.createPublicVehicleInquiry
);

// ===== WEBSITE SETTINGS PUBLIC =====

// GET /api/public/website-settings
router.get('/website-settings', publicController.getPublicWebsiteSettings);

module.exports = router;