const reservationPaymentService = require('../services/reservationPaymentService');

const createReservationPayment = async (req, res, next) => {
  try {
    const result = await reservationPaymentService.createReservationPayment(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const listPendingReservationPayments = async (req, res, next) => {
  try {
    const result = await reservationPaymentService.listPendingReservationPayments(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const listReservationPayments = async (req, res, next) => {
  try {
    const result = await reservationPaymentService.listReservationPayments(req.params.reservationId, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getReservationPayment = async (req, res, next) => {
  try {
    const result = await reservationPaymentService.getReservationPayment(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateReservationPayment = async (req, res, next) => {
  try {
    const result = await reservationPaymentService.updateReservationPayment(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const validateReservationPayment = async (req, res, next) => {
  try {
    const result = await reservationPaymentService.validateReservationPayment(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const rejectReservationPayment = async (req, res, next) => {
  try {
    const result = await reservationPaymentService.rejectReservationPayment(req.params.id, req.user, req.body?.reason);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const cancelReservationPayment = async (req, res, next) => {
  try {
    const result = await reservationPaymentService.cancelReservationPayment(req.params.id, req.user, req.body?.reason);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listPendingReservationPayments,
  createReservationPayment,
  listReservationPayments,
  getReservationPayment,
  updateReservationPayment,
  validateReservationPayment,
  rejectReservationPayment,
  cancelReservationPayment,
};
