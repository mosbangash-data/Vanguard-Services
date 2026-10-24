const crypto = require('crypto');

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

const isApiRequest = (req) => req.path.startsWith('/api') || req.originalUrl.startsWith('/api');

const PUBLIC_RESERVATION_CONFLICT_MESSAGES = new Set([
  'Trip is not available',
  'Vanguard Coach currency is not configured for reservations',
  'This seat was just reserved. Please choose another seat.',
  'This reservation conflicts with an existing record. Please refresh and try again.',
]);

const notFoundHandler = (req, res, next) => {
  next(new AppError(`Ressource introuvable : ${req.originalUrl}`, 404));
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Une erreur inattendue est survenue.';
  const publicMessage = err.isOperational
    ? message
    : 'Une erreur interne est survenue. Veuillez réessayer.';
  const errorId = crypto.randomUUID();

  if (process.env.NODE_ENV !== 'production') {
    console.error('[api-error]', {
      errorId,
      name: err.name,
      message,
      code: err.code,
      meta: err.meta,
      stack: err.stack,
      statusCode,
    });
  } else {
    const isPublicReservationCreate = req.method === 'POST' &&
      req.originalUrl.split('?')[0] === '/api/public/reservations';
    const route = req.route?.path
      ? `${req.baseUrl || ''}${req.route.path}`
      : (isPublicReservationCreate ? '/api/public/reservations' : '<unmatched-route>');
    const logEntry = {
      errorId,
      errorType: err.name || 'Error',
      route,
      statusCode,
      code: err.code || null,
    };
    // These are fixed domain messages. Avoid arbitrary exception messages,
    // request data, parameters, query strings, and Prisma metadata in prod logs.
    if (isPublicReservationCreate && PUBLIC_RESERVATION_CONFLICT_MESSAGES.has(message)) {
      logEntry.message = message;
    }
    console.error('[api-error]', logEntry);
  }

  if (isApiRequest(req)) {
    return res.status(statusCode).json({
      success: false,
      message: publicMessage,
      errorId,
    });
  }

  return res.status(statusCode).render('pages/error', {
    title: 'Erreur',
    message: publicMessage,
    statusCode,
  });
};

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
};
