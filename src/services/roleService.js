const prisma = require('../config/prisma');
const roleRepository = require('./roleRepository');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');

const VALID_ROLE_NAMES = ['SUPER_ADMIN', 'SERVICE_ADMIN', 'MANAGER', 'AGENT'];

const normalizeRoleName = (value) => {
  const rawName = typeof value === 'string' ? value.trim() : '';
  if (!rawName) {
    throw new AppError('Role name is required', 400);
  }

  const upperName = rawName.toUpperCase();
  if (VALID_ROLE_NAMES.includes(upperName)) return upperName;
  throw new AppError('Invalid role name', 400);
};

const normalizePage = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const normalizeLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  if (parsed < 1) return 1;
  return Math.min(parsed, 100);
};

const buildPagination = (page, limit, total) => ({ page, limit, total });

const listRoles = async (query = {}, currentUser) => {
  if (!currentUser || !['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(currentUser.role)) {
    throw new AppError('Access denied', 403);
  }

  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    roleRepository.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: { permissions: { include: { permission: true } } },
    }),
    roleRepository.count(where),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      permissions: item.permissions.map(({ permission }) => permission.name),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    ...buildPagination(page, limit, total),
  };
};

const getRoleById = async (roleId, currentUser) => {
  if (!currentUser || !['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(currentUser.role)) {
    throw new AppError('Access denied', 403);
  }

  const role = await roleRepository.findById(roleId);

  if (!role) {
    throw new AppError('Role not found', 404);
  }

  return {
    role: {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map(({ permission }) => permission.name),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    },
  };
};

const getRolePermissions = async (roleId, currentUser) => {
  if (!currentUser || !['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(currentUser.role)) {
    throw new AppError('Access denied', 403);
  }

  const role = await roleRepository.findById(roleId);

  if (!role) {
    throw new AppError('Role not found', 404);
  }

  return role.permissions.map(({ permission }) => permission);
};

const setRolePermissions = async (roleId, permissionIds, currentUser) => {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can manage role permissions', 403);
  }

  const role = await roleRepository.findById(roleId);
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  if (!Array.isArray(permissionIds)) {
    throw new AppError('permissionIds must be an array', 400);
  }

  // Validate all permission IDs exist
  const uniqueIds = [...new Set(permissionIds)];
  if (uniqueIds.length > 0) {
    const existing = await prisma.permission.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (existing.length !== uniqueIds.length) {
      throw new AppError('One or more permissions do not exist', 400);
    }
  }

  // Replace all role permissions in a transaction
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    ...uniqueIds.map((permissionId) =>
      prisma.rolePermission.create({
        data: { roleId, permissionId },
      })
    ),
  ]);

  await auditService.log('update_role_permissions', currentUser.id, {
    targetRoleId: roleId,
    permissionIds: uniqueIds,
  });

  const updatedRole = await roleRepository.findById(roleId);
  return updatedRole.permissions.map(({ permission }) => permission);
};

const createRole = async (data, currentUser) => {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can manage roles', 403);
  }

  const name = normalizeRoleName(data?.name);
  const description = typeof data?.description === 'string' ? data.description.trim() : null;

  const existingRole = await roleRepository.findByName(name);
  if (existingRole) {
    await auditService.log('create_role', currentUser.id, { targetRoleId: existingRole.id, name });
    return { role: { id: existingRole.id, name: existingRole.name, description: existingRole.description, createdAt: existingRole.createdAt, updatedAt: existingRole.updatedAt } };
  }

  const role = await roleRepository.createRole({ name, description });
  await auditService.log('create_role', currentUser.id, { targetRoleId: role.id, name });

  return { role: { id: role.id, name: role.name, description: role.description, createdAt: role.createdAt, updatedAt: role.updatedAt } };
};

const updateRole = async (roleId, data, currentUser) => {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can manage roles', 403);
  }

  const role = await roleRepository.findById(roleId);
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  const updatePayload = {};
  if (data?.name !== undefined) {
    updatePayload.name = normalizeRoleName(data.name);
  }
  if (data?.description !== undefined) {
    updatePayload.description = typeof data.description === 'string' && data.description.trim() ? data.description.trim() : null;
  }

  const updatedRole = await roleRepository.updateRole(roleId, updatePayload);
  await auditService.log('update_role', currentUser.id, { targetRoleId: roleId, name: updatedRole.name });

  return { role: { id: updatedRole.id, name: updatedRole.name, description: updatedRole.description, createdAt: updatedRole.createdAt, updatedAt: updatedRole.updatedAt } };
};

const deleteRole = async (roleId, currentUser) => {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can manage roles', 403);
  }

  const role = await roleRepository.findById(roleId);
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  const linkedUsers = await roleRepository.countUsersWithRole(roleId);
  if (linkedUsers > 0) {
    throw new AppError('Role is still assigned to users', 409);
  }

  await roleRepository.deleteRolePermissions(roleId);
  await roleRepository.deleteRole(roleId);
  await auditService.log('delete_role', currentUser.id, { targetRoleId: roleId });

  return { success: true };
};

module.exports = {
  listRoles,
  getRoleById,
  getRolePermissions,
  setRolePermissions,
  createRole,
  updateRole,
  deleteRole,
};
