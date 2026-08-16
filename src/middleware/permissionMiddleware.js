const { AppError } = require('./errorHandler');

const requireRole = (...allowedRoles) => (req, res, next) => {
  const userRole = req.user?.role;

  if (!userRole || !allowedRoles.includes(userRole)) {
    return next(new AppError('Insufficient role permissions', 403));
  }

  return next();
};

const requirePermission = (...requiredPermissions) => (req, res, next) => {
  const userPermissions = req.user?.permissions || [];

  const hasAllPermissions = requiredPermissions.every((permission) => userPermissions.includes(permission));

  if (!hasAllPermissions) {
    return next(new AppError('Insufficient permissions', 403));
  }

  return next();
};

const requireAnyPermission = (...permissions) => (req, res, next) => {
  const userPermissions = req.user?.permissions || [];
  const hasAnyPermission = permissions.some((permission) => userPermissions.includes(permission));

  if (!hasAnyPermission) {
    return next(new AppError('Insufficient permissions', 403));
  }

  return next();
};

module.exports = {
  requireRole,
  requirePermission,
  requireAnyPermission,
};
