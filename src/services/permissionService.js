const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');

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

const listPermissions = async (query = {}, currentUser) => {
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
    prisma.permission.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.permission.count({ where }),
  ]);

  return {
    items,
    ...buildPagination(page, limit, total),
  };
};

const getPermissionById = async (permissionId, currentUser) => {
  if (!currentUser || !['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(currentUser.role)) {
    throw new AppError('Access denied', 403);
  }

  const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
  if (!permission) {
    throw new AppError('Permission not found', 404);
  }

  return { permission };
};

const createPermission = async (data, currentUser) => {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can manage permissions', 403);
  }

  const name = typeof data?.name === 'string' ? data.name.trim().toUpperCase() : '';
  const description = typeof data?.description === 'string' ? data.description.trim() : null;

  if (!name) {
    throw new AppError('Permission name is required', 400);
  }

  const existingPermission = await prisma.permission.findUnique({ where: { name } });
  if (existingPermission) {
    throw new AppError('Permission already exists', 409);
  }

  const permission = await prisma.permission.create({ data: { name, description } });
  await auditService.log('create_permission', currentUser.id, { targetPermissionId: permission.id, name });

  return { permission };
};

const updatePermission = async (permissionId, data, currentUser) => {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can manage permissions', 403);
  }

  const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
  if (!permission) {
    throw new AppError('Permission not found', 404);
  }

  const updatePayload = {};
  if (data?.name !== undefined) {
    const name = typeof data.name === 'string' ? data.name.trim().toUpperCase() : '';
    if (!name) {
      throw new AppError('Permission name is required', 400);
    }
    updatePayload.name = name;
  }
  if (data?.description !== undefined) {
    updatePayload.description = typeof data.description === 'string' && data.description.trim() ? data.description.trim() : null;
  }

  const updatedPermission = await prisma.permission.update({ where: { id: permissionId }, data: updatePayload });
  await auditService.log('update_permission', currentUser.id, { targetPermissionId: permissionId, name: updatedPermission.name });

  return { permission: updatedPermission };
};

const deletePermission = async (permissionId, currentUser) => {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can manage permissions', 403);
  }

  const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
  if (!permission) {
    throw new AppError('Permission not found', 404);
  }

  const linkedRoles = await prisma.rolePermission.count({ where: { permissionId } });
  if (linkedRoles > 0) {
    throw new AppError('Permission is still assigned to roles', 409);
  }

  await prisma.permission.delete({ where: { id: permissionId } });
  await auditService.log('delete_permission', currentUser.id, { targetPermissionId: permissionId });

  return { success: true };
};

module.exports = {
  listPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
};
