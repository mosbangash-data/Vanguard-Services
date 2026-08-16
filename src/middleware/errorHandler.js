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

  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }

  if (isApiRequest(req)) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
    });
  }

  return res.status(statusCode).render('pages/error', {
    title: 'Erreur',
    message,
    statusCode,
  });
};

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
};
