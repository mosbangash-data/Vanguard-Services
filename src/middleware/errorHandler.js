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
    console.error('[api-error]', { errorId, name: err.name, code: err.code, statusCode });
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
