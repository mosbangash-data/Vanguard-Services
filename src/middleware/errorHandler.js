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

  if (process.env.NODE_ENV !== 'production') {
    console.error('[api-error]', {
      name: err.name,
      message,
      statusCode,
    });
  }

  if (isApiRequest(req)) {
    return res.status(statusCode).json({
      success: false,
      message: publicMessage,
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
