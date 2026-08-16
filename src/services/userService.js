const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const userRepository = require('./userRepository');

const normalizeSearch = (value) => (typeof value === 'string' ? value.trim() : '');

const getAccessibleDepartmentIds = async (user) => {
  if (user.role === 'SUPER_ADMIN') return null;
  if (user.role === 'SERVICE_ADMIN' && user.department?.type) {
    const departments = await prisma.department.findMany({
      where: { type: user.department.type },
      select: { id: true },
    });
    return departments.map((department) => department.id);
  }
  return [];
};

const enforceDepartmentAccess = async (user, departmentId) => {
  const allowed = await getAccessibleDepartmentIds(user);
  if (allowed === null) return;
  if (!departmentId || !allowed.includes(departmentId)) {
    throw new AppError('Access to this department is not allowed', 403);
  }
};

const assertManageableUser = async (targetUser, currentUser, { creating = false, requestedDepartmentId = null, requestedRole = null } = {}) => {
  if (!currentUser || !['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(currentUser.role)) {
    throw new AppError('Access denied', 403);
  }
  if (currentUser.role === 'SUPER_ADMIN') return;

  const departmentIds = await getAccessibleDepartmentIds(currentUser);
  const targetDepartmentId = requestedDepartmentId || targetUser?.department?.id;
  if (!targetDepartmentId || !departmentIds.includes(targetDepartmentId)) {
    throw new AppError('Access to this department is not allowed', 403);
  }
  if (targetUser?.role?.name === 'SERVICE_ADMIN' || requestedRole?.name === 'SERVICE_ADMIN') {
    throw new AppError('SERVICE_ADMIN cannot manage service administrators', 403);
  }
  if (creating && requestedRole?.name !== 'AGENT') {
    throw new AppError('SERVICE_ADMIN can only create AGENT users', 403);
  }
};

const listUsers = async (query = {}, currentUser) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const where = {};
  const accessibleDepartmentIds = await getAccessibleDepartmentIds(currentUser);
  if (accessibleDepartmentIds !== null && accessibleDepartmentIds.length === 0) {
    return { items: [], page, limit, total: 0 };
  }

  if (query.departmentId) {
    await enforceDepartmentAccess(currentUser, query.departmentId);
    where.departmentId = query.departmentId;
  } else if (accessibleDepartmentIds !== null) {
    where.departmentId = { in: accessibleDepartmentIds };
  }
  if (query.roleId) {
    where.roleId = query.roleId;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.search) {
    const search = normalizeSearch(query.search);
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
  }

  const [items, total] = await Promise.all([
    userRepository.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        role: true,
        department: true,
      },
    }),
    userRepository.count(where),
  ]);

  return { items, page, limit, total };
};

const getUserById = async (userId, currentUser) => {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const accessibleDepartmentIds = await getAccessibleDepartmentIds(currentUser);
  if (accessibleDepartmentIds !== null && accessibleDepartmentIds.length === 0) {
    throw new AppError('Access denied', 403);
  }
  if (accessibleDepartmentIds !== null && user.department?.id && !accessibleDepartmentIds.includes(user.department.id)) {
    throw new AppError('Access to this department is not allowed', 403);
  }

  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      firstLogin: user.firstLogin,
      role: user.role.name,
      department: user.department ? { id: user.department.id, type: user.department.type, name: user.department.name } : null,
      permissions: user.role.permissions.map(({ permission }) => permission.name),
    },
  };
};

const createUser = async (data, currentUser) => {
  const { firstName, lastName, phone, email, roleId, departmentId } = data;
  if (!firstName || !lastName || !email || !roleId || !departmentId) {
    throw new AppError('firstName, lastName, email, roleId and departmentId are required', 400);
  }

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    throw new AppError('Department not found', 404);
  }
  await assertManageableUser(null, currentUser, { creating: true, requestedDepartmentId: department.id, requestedRole: role });

  const existingUser = await userRepository.findByEmail(email.toLowerCase().trim());
  if (existingUser) {
    throw new AppError('Email already exists', 409);
  }

  const temporaryPassword = `${firstName.toLowerCase()}${Math.floor(1000 + Math.random() * 9000)}!`;
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const user = await userRepository.createUser({
    firstName,
    lastName,
    phone,
    email: email.toLowerCase().trim(),
    passwordHash,
    firstLogin: true,
    roleId,
    departmentId,
    status: 'ACTIVE',
  });

  await auditService.log('create_user', currentUser.id, { targetUserId: user.id, departmentId: department.id });

  return { user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, status: user.status, role: user.role.name, department: user.department ? { type: user.department.type, name: user.department.name } : null, temporaryPassword }, firstLogin: true };
};

const updateUser = async (userId, data, currentUser) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  await assertManageableUser(user, currentUser);

  const updatePayload = {};
  if (data?.firstName !== undefined) {
    updatePayload.firstName = data.firstName;
  }
  if (data?.lastName !== undefined) {
    updatePayload.lastName = data.lastName;
  }
  if (data?.phone !== undefined) {
    updatePayload.phone = data.phone;
  }

  const updatedUser = await userRepository.updateUserById(userId, updatePayload);

  await auditService.log('update_user', currentUser.id, { targetUserId: userId });

  return { user: { id: updatedUser.id, firstName: updatedUser.firstName, lastName: updatedUser.lastName, email: updatedUser.email, status: updatedUser.status, role: updatedUser.role.name, department: updatedUser.department ? { type: updatedUser.department.type, name: updatedUser.department.name } : null } };
};

const updateUserStatus = async (userId, body, currentUser) => {
  const { status } = body;
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    throw new AppError('status must be ACTIVE or INACTIVE', 400);
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  await assertManageableUser(user, currentUser);

  const updatedUser = await userRepository.updateUserById(userId, { status });

  await auditService.log('update_user_status', currentUser.id, { targetUserId: userId, status });

  return { user: { id: updatedUser.id, firstName: updatedUser.firstName, lastName: updatedUser.lastName, email: updatedUser.email, status: updatedUser.status, role: updatedUser.role.name, department: updatedUser.department ? { type: updatedUser.department.type, name: updatedUser.department.name } : null } };
};

const resetUserPassword = async (userId, currentUser) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  await assertManageableUser(user, currentUser);

  const temporaryPassword = `${user.firstName.toLowerCase()}${Math.floor(1000 + Math.random() * 9000)}!`;
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  const updatedUser = await userRepository.updateUserById(userId, { passwordHash, firstLogin: true });

  await auditService.log('reset_password', currentUser.id, { targetUserId: userId });

  return { user: { id: updatedUser.id, firstName: updatedUser.firstName, lastName: updatedUser.lastName, email: updatedUser.email, firstLogin: updatedUser.firstLogin, role: updatedUser.role.name, department: updatedUser.department ? { type: updatedUser.department.type, name: updatedUser.department.name } : null, temporaryPassword } };
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  enforceDepartmentAccess,
};
