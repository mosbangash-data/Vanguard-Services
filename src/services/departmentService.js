const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');

const DEPARTMENT_TYPES = ['VANGUARD_COACH', 'CONSTRUCTION', 'AUTO_SALES'];
const departmentPriority = new Map(DEPARTMENT_TYPES.map((type, index) => [type, index]));

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

const listDepartments = async (query = {}, currentUser) => {
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
          { type: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [allItems, total] = await Promise.all([
    prisma.department.findMany({ where, skip, take: limit }),
    prisma.department.count({ where }),
  ]);

  const items = [...allItems].sort((left, right) => {
    const leftPriority = departmentPriority.get(left.type) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = departmentPriority.get(right.type) ?? Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.name.localeCompare(right.name);
  });

  return {
    items,
    ...buildPagination(page, limit, total),
  };
};

const getDepartmentById = async (departmentId, currentUser) => {
  if (!currentUser || !['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(currentUser.role)) {
    throw new AppError('Access denied', 403);
  }

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    throw new AppError('Department not found', 404);
  }

  return { department };
};

const createDepartment = async (data, currentUser) => {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can manage departments', 403);
  }

  const type = typeof data?.type === 'string' ? data.type.trim().toUpperCase() : '';
  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  const description = typeof data?.description === 'string' ? data.description.trim() : null;
  const isActive = data?.isActive !== undefined ? Boolean(data.isActive) : true;

  if (!type || !DEPARTMENT_TYPES.includes(type)) {
    throw new AppError('Department type is invalid', 400);
  }
  if (!name) {
    throw new AppError('Department name is required', 400);
  }

  const existingDepartment = await prisma.department.findUnique({ where: { type } });
  if (existingDepartment) {
    throw new AppError('Department already exists', 409);
  }

  const department = await prisma.department.create({ data: { type, name, description, isActive } });
  await auditService.log('create_department', currentUser.id, { targetDepartmentId: department.id, type });

  return { department };
};

const updateDepartment = async (departmentId, data, currentUser) => {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can manage departments', 403);
  }

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    throw new AppError('Department not found', 404);
  }

  const updatePayload = {};
  if (data?.name !== undefined) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) {
      throw new AppError('Department name is required', 400);
    }
    updatePayload.name = name;
  }
  if (data?.description !== undefined) {
    updatePayload.description = typeof data.description === 'string' && data.description.trim() ? data.description.trim() : null;
  }
  if (data?.isActive !== undefined) {
    updatePayload.isActive = Boolean(data.isActive);
  }

  const updatedDepartment = await prisma.department.update({ where: { id: departmentId }, data: updatePayload });
  await auditService.log('update_department', currentUser.id, { targetDepartmentId: departmentId });

  return { department: updatedDepartment };
};

const deleteDepartment = async (departmentId, currentUser) => {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can manage departments', 403);
  }

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    throw new AppError('Department not found', 404);
  }

  const linkedUsers = await prisma.user.count({ where: { departmentId } });
  if (linkedUsers > 0) {
    throw new AppError('Department is still assigned to users', 409);
  }

  await prisma.department.delete({ where: { id: departmentId } });
  await auditService.log('delete_department', currentUser.id, { targetDepartmentId: departmentId });

  return { success: true };
};

const assertDepartmentAdminAccess = async (departmentId, currentUser) => {
  if (!currentUser || !['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(currentUser.role)) {
    throw new AppError('Access denied', 403);
  }
  if (currentUser.role === 'SUPER_ADMIN') return;

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    throw new AppError('Department not found', 404);
  }
  if (department.type !== currentUser.department?.type && department.id !== currentUser.department?.id) {
    throw new AppError('Access to this department is not allowed', 403);
  }
};

const getDepartmentSettings = async (departmentId, currentUser) => {
  await assertDepartmentAdminAccess(departmentId, currentUser);

  let settings = await prisma.serviceSettings.findUnique({ where: { departmentId } });
  if (!settings) {
    settings = await prisma.serviceSettings.create({
      data: {
        departmentId,
        currency: 'USD',
        reservationEnabled: true,
      },
    });
  }

  return { settings };
};

const updateDepartmentSettings = async (departmentId, data, currentUser) => {
  await assertDepartmentAdminAccess(departmentId, currentUser);

  const updateData = {};
  if (data?.currency !== undefined) {
    const currency = typeof data.currency === 'string' ? data.currency.trim().toUpperCase() : 'USD';
    if (!currency) throw new AppError('Currency cannot be empty', 400);
    updateData.currency = currency;
  }
  if (data?.reservationEnabled !== undefined) {
    updateData.reservationEnabled = Boolean(data.reservationEnabled);
  }
  if (data?.paymentConfig !== undefined) {
    updateData.paymentConfig = data.paymentConfig;
  }
  if (data?.rules !== undefined) {
    updateData.rules = data.rules;
  }

  const settings = await prisma.serviceSettings.upsert({
    where: { departmentId },
    update: updateData,
    create: {
      departmentId,
      currency: updateData.currency || 'USD',
      reservationEnabled: updateData.reservationEnabled !== undefined ? updateData.reservationEnabled : true,
      paymentConfig: updateData.paymentConfig || null,
      rules: updateData.rules || null,
    },
  });

  await auditService.log('update_department_settings', currentUser.id, { targetDepartmentId: departmentId });

  return { settings };
};

const listPaymentMethods = async (departmentId, currentUser) => {
  await assertDepartmentAdminAccess(departmentId, currentUser);

  const paymentMethods = await prisma.paymentMethodConfig.findMany({
    where: { departmentId },
    orderBy: { createdAt: 'asc' },
  });

  return { paymentMethods };
};

const createPaymentMethod = async (departmentId, data, currentUser) => {
  await assertDepartmentAdminAccess(departmentId, currentUser);

  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
  const isActive = data?.isActive !== undefined ? Boolean(data.isActive) : true;
  const config = data?.config || null;

  if (!name || !code) {
    throw new AppError('Name and code are required for payment method', 400);
  }

  const existing = await prisma.paymentMethodConfig.findUnique({
    where: { departmentId_code: { departmentId, code } },
  });
  if (existing) {
    throw new AppError('Payment method with this code already exists for this department', 409);
  }

  const paymentMethod = await prisma.paymentMethodConfig.create({
    data: {
      departmentId,
      name,
      code,
      isActive,
      config,
    },
  });

  await auditService.log('create_payment_method', currentUser.id, { targetDepartmentId: departmentId, code });

  return { paymentMethod };
};

const updatePaymentMethod = async (departmentId, code, data, currentUser) => {
  await assertDepartmentAdminAccess(departmentId, currentUser);

  const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
  const existing = await prisma.paymentMethodConfig.findUnique({
    where: { departmentId_code: { departmentId, code: normalizedCode } },
  });
  if (!existing) {
    throw new AppError('Payment method not found', 404);
  }

  const updateData = {};
  if (data?.name !== undefined) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) throw new AppError('Name cannot be empty', 400);
    updateData.name = name;
  }
  if (data?.isActive !== undefined) {
    updateData.isActive = Boolean(data.isActive);
  }
  if (data?.config !== undefined) {
    updateData.config = data.config;
  }

  const updatedPaymentMethod = await prisma.paymentMethodConfig.update({
    where: { id: existing.id },
    data: updateData,
  });

  await auditService.log('update_payment_method', currentUser.id, { targetDepartmentId: departmentId, code: normalizedCode });

  return { paymentMethod: updatedPaymentMethod };
};

const deletePaymentMethod = async (departmentId, code, currentUser) => {
  await assertDepartmentAdminAccess(departmentId, currentUser);

  const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
  const existing = await prisma.paymentMethodConfig.findUnique({
    where: { departmentId_code: { departmentId, code: normalizedCode } },
  });
  if (!existing) {
    throw new AppError('Payment method not found', 404);
  }

  await prisma.paymentMethodConfig.delete({
    where: { id: existing.id },
  });

  await auditService.log('delete_payment_method', currentUser.id, { targetDepartmentId: departmentId, code: normalizedCode });

  return { success: true, message: 'Payment method deleted successfully' };
};

module.exports = {
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentSettings,
  updateDepartmentSettings,
  listPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
};
