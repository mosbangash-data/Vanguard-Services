class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

const notFoundHandler = (req, res, next) => {
  next(new AppError(`Route introuvable : ${req.originalUrl}`, 404));
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    message: err.message || 'Erreur interne du serveur',
  };

  return res.status(statusCode).json(response);
};

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
};
