const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepository = require('./userRepository');
const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

const JWT_SECRET = env.jwtSecret;
const JWT_EXPIRES_IN = env.jwtExpiresIn;

const normalizeIdentifier = (value) => (typeof value === 'string' ? value.trim() : '');

const resolvePermissionNames = async (user) => {
  const permissionNames = [];
  const directPermissions = Array.isArray(user?.role?.permissions) ? user.role.permissions : [];

  for (const entry of directPermissions) {
    const permissionName = entry?.permission?.name || entry?.name || entry;
    if (typeof permissionName === 'string' && permissionName.trim()) {
      permissionNames.push(permissionName.trim());
    }
  }

  if (permissionNames.length > 0) {
    return [...new Set(permissionNames)];
  }

  if (!user?.roleId) {
    return [];
  }

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: user.roleId },
    include: { permission: true },
  });

  const fallbackNames = rolePermissions
    .map(({ permission }) => permission?.name)
    .filter((name) => typeof name === 'string' && name.trim());

  return [...new Set(fallbackNames)];
};

const buildUserResponse = async (user) => {
  const permissions = await resolvePermissionNames(user);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
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

const login = async ({ identifier, password }) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier || !password) {
    throw new AppError('Identifier and password are required', 400);
  }

  const user = await userRepository.findByIdentifier(normalizedIdentifier);

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError('User account is inactive', 403);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }

  const token = jwt.sign({ sub: user.id, role: user.role.name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  const userResponse = await buildUserResponse(user);

  return {
    token,
    user: userResponse,
  };
};

const getUserForAuth = async (userId) => {
  return userRepository.findById(userId);
};

const getCurrentUser = async (userId) => {
  const user = await getUserForAuth(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const userResponse = await buildUserResponse(user);

  return {
    user: userResponse,
  };
};

/**
 * @deprecated Administrative user creation should be handled through userService.
 */
const createUser = async (data) => {
  const { email, password, firstName, lastName, phone, roleName, departmentType, status = 'ACTIVE' } = data;

  if (!email || !password || !firstName || !lastName || !roleName || !departmentType) {
    throw new AppError('Email, password, first name, last name, role and department are required', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await userRepository.findByEmail(normalizedEmail);
  if (existingUser) {
    throw new AppError('Email already exists', 409);
  }

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  const department = await prisma.department.findUnique({ where: { type: departmentType } });
  if (!department) {
    throw new AppError('Department not found', 404);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userRepository.createUser({
    email: normalizedEmail,
    passwordHash,
    firstName,
    lastName,
    phone,
    roleId: role.id,
    departmentId: department.id,
    status,
  });

  return { user: buildUserResponse(user) };
};

/**
 * @deprecated Administrative user updates should be handled through userService.
 */
const updateUser = async (userId, data) => {
  const existingUser = await userRepository.findById(userId);
  if (!existingUser) {
    throw new AppError('User not found', 404);
  }

  const updatePayload = {};
  if (data.firstName) updatePayload.firstName = data.firstName;
  if (data.lastName) updatePayload.lastName = data.lastName;
  if (data.phone !== undefined) updatePayload.phone = data.phone;

  const updatedUser = await userRepository.updateUserById(userId, updatePayload);

  return { user: buildUserResponse(updatedUser) };
};

/**
 * @deprecated Administrative user status changes should be handled through userService.
 */
const updateUserStatus = async (userId, status) => {
  const existingUser = await userRepository.findById(userId);
  if (!existingUser) {
    throw new AppError('User not found', 404);
  }

  const updatedUser = await userRepository.updateUserById(userId, { status });

  return { user: buildUserResponse(updatedUser) };
};

/**
 * @deprecated Administrative password resets should be handled through userService.
 */
const resetPassword = async (userId, newPassword) => {
  const existingUser = await userRepository.findById(userId);
  if (!existingUser) {
    throw new AppError('User not found', 404);
  }

  if (!newPassword) {
    throw new AppError('New password is required', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const updatedUser = await userRepository.updateUserById(userId, { passwordHash });

  return { user: buildUserResponse(updatedUser) };
};

module.exports = {
  login,
  getUserForAuth,
  getCurrentUser,
  createUser,
  updateUser,
  updateUserStatus,
  resetPassword,
};
