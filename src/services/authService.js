const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepository = require('./userRepository');
const prisma = require('../config/prisma');
const auditService = require('./auditService');
const { AppError } = require('../middleware/errorHandler');

const JWT_SECRET = env.jwtSecret;
const JWT_EXPIRES_IN = env.jwtExpiresIn;

const normalizeIdentifier = (value) => (typeof value === 'string' ? value.trim() : '');

const isRoleDepartmentCompatible = (roleName, departmentType) => (
  roleName === 'SUPER_ADMIN'
  || (roleName === 'SERVICE_ADMIN' && ['VANGUARD_COACH', 'CONSTRUCTION', 'AUTO_SALES'].includes(departmentType))
  || (['MANAGER', 'AGENT'].includes(roleName) && departmentType === 'VANGUARD_COACH')
);

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
    firstLogin: user.firstLogin ?? false,
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

  if (!isRoleDepartmentCompatible(user.role.name, user.department?.type)) {
    throw new AppError('Role is not valid for this department', 403);
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

const changePassword = async (userId, data) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  if (user.status !== 'ACTIVE') {
    throw new AppError('User account is inactive', 403);
  }

  const currentPassword = data?.currentPassword || data?.oldPassword;
  const newPassword = data?.newPassword;
  const confirmPassword = data?.confirmPassword || data?.confirmNewPassword;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new AppError('Current password, new password and confirmation are required', 400);
  }

  if (newPassword !== confirmPassword) {
    throw new AppError('New password and confirmation do not match', 400);
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters long', 400);
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    throw new AppError('Current password is incorrect', 400);
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSamePassword) {
    throw new AppError('New password must be different from current password', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await userRepository.updateUserById(userId, {
    passwordHash,
    firstLogin: false,
  });

  await auditService.log('change_password', userId, { targetUserId: userId });

  return { success: true, message: 'Password changed successfully' };
};

const forgotPassword = async ({ email }) => {
  const normalizedEmail = (typeof email === 'string' ? email : '').toLowerCase().trim();
  if (!normalizedEmail) {
    throw new AppError('Email is required', 400);
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (user && user.status === 'ACTIVE') {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    await auditService.log('forgot_password_requested', user.id, { email: normalizedEmail });

  }

  return {
    success: true,
    message: 'If this email is associated with an account, a password reset link has been sent.',
  };
};

const resetPasswordWithToken = async (data) => {
  const rawToken = typeof data?.token === 'string' ? data.token.trim() : '';
  const newPassword = typeof data?.newPassword === 'string' ? data.newPassword : '';
  const confirmPassword = typeof data?.confirmPassword === 'string'
    ? data.confirmPassword
    : (typeof data?.confirmNewPassword === 'string' ? data.confirmNewPassword : '');

  if (!rawToken || !newPassword || !confirmPassword) {
    throw new AppError('Token, new password and confirmation are required', 400);
  }

  if (newPassword !== confirmPassword) {
    throw new AppError('New password and confirmation do not match', 400);
  }

  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters long', 400);
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!tokenRecord) {
    throw new AppError('Invalid or expired password reset token', 400);
  }

  if (tokenRecord.usedAt !== null) {
    throw new AppError('Password reset token has already been used', 400);
  }

  if (tokenRecord.expiresAt < new Date()) {
    throw new AppError('Password reset token has expired', 400);
  }

  if (tokenRecord.user.status !== 'ACTIVE') {
    throw new AppError('User account is inactive', 403);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: tokenRecord.userId },
      data: {
        passwordHash,
        firstLogin: false,
      },
    }),
  ]);

  await auditService.log('reset_password_completed', tokenRecord.userId, { targetUserId: tokenRecord.userId });

  return { success: true, message: 'Password has been reset successfully' };
};

const resetPassword = resetPasswordWithToken;

module.exports = {
  login,
  getUserForAuth,
  getCurrentUser,
  changePassword,
  forgotPassword,
  resetPasswordWithToken,
  createUser,
  updateUser,
  updateUserStatus,
  resetPassword,
};
