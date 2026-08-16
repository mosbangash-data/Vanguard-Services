const jwt = require('jsonwebtoken');
const authService = require('../services/authService');
const { AppError } = require('./errorHandler');
const env = require('../config/env');
const prisma = require('../config/prisma');

const normalizePermissionNames = (user) => {
  const permissionNames = [];
  const directPermissions = Array.isArray(user?.role?.permissions) ? user.role.permissions : [];

  for (const item of directPermissions) {
    const name = item?.permission?.name || item?.name || item;
    if (typeof name === 'string' && name.trim()) {
      permissionNames.push(name.trim());
    }
  }

  return [...new Set(permissionNames)];
};

const hydratePermissionsFromRole = async (user) => {
  const normalized = normalizePermissionNames(user);
  if (normalized.length > 0) {
    return normalized;
  }

  if (!user?.roleId) {
    return [];
  }

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: user.roleId },
    include: { permission: true },
  });

  return [...new Set(rolePermissions.map(({ permission }) => permission?.name).filter((name) => typeof name === 'string' && name.trim()))];
};

const buildUserFromToken = async (token) => {
  if (!token) return null;
  const decoded = jwt.verify(token, env.jwtSecret);
  const user = await authService.getUserForAuth(decoded.sub);
  if (!user) return null;
  if (user.status !== 'ACTIVE') {
    throw new AppError('User account is inactive', 403);
  }

  const permissions = await hydratePermissionsFromRole(user);

  return {
    id: user.id,
    email: user.email,
    role: user.role?.name || null,
    department: user.department
      ? {
          type: user.department.type,
          name: user.department.name,
        }
      : null,
    permissions,
  };
};

const authenticateToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return next(new AppError('Authentication token required', 401));
    }

    const user = await buildUserFromToken(token);
    if (!user) {
      return next(new AppError('User not found', 401));
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError('Invalid or expired token', 401));
  }
};

const optionalAuthenticateToken = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return next();
  }

  try {
    const user = await buildUserFromToken(token);
    if (user) {
      req.user = user;
    }
  } catch (error) {
    // Ignore invalid or expired optional tokens for public routes.
  }

  return next();
};

module.exports = {
  authenticateToken,
  optionalAuthenticateToken,
  buildUserFromToken,
};
