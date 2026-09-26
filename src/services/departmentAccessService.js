const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

const requireAuthenticatedUser = (user) => {
  if (!user) throw new AppError('Unauthorized', 401);
};

const requireDepartmentType = (user, departmentType) => {
  requireAuthenticatedUser(user);
  if (user.role !== 'SUPER_ADMIN' && user.department?.type !== departmentType) {
    throw new AppError('Access denied', 403);
  }
};

const requireCoachAdmin = (user) => {
  requireDepartmentType(user, 'VANGUARD_COACH');
  if (!['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(user.role)) {
    throw new AppError('Access denied', 403);
  }
};

const getUserAgencyId = (user) => user?.agencyId || user?.agency?.id || null;

const requireCoachOperational = (user, permission = null) => {
  requireDepartmentType(user, 'VANGUARD_COACH');
  if (permission && !user.permissions?.includes(permission)) {
    throw new AppError('Insufficient permissions', 403);
  }
  if (user.role === 'AGENT' && !getUserAgencyId(user)) {
    throw new AppError('Agent agency assignment is required', 403);
  }
};

const assertAgencyAccess = (user, agencyId) => {
  requireDepartmentType(user, 'VANGUARD_COACH');
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'SERVICE_ADMIN' && user.role !== 'MANAGER') {
    const userAgencyId = getUserAgencyId(user);
    if (!userAgencyId || !agencyId || userAgencyId !== agencyId) {
      throw new AppError('Access denied: resource belongs to another agency', 403);
    }
  }
};

const requireAutomobileAdmin = (user) => {
  requireDepartmentType(user, 'AUTO_SALES');
  if (!['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(user.role)) {
    throw new AppError('Access denied', 403);
  }
};

const requireConstructionAdmin = (user) => {
  requireDepartmentType(user, 'CONSTRUCTION');
  if (!['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(user.role)) {
    throw new AppError('Access denied', 403);
  }
};

const getScopedDepartmentId = async (user, requestedDepartmentId, departmentType) => {
  requireDepartmentType(user, departmentType);

  if (user.role === 'SUPER_ADMIN') {
    if (!requestedDepartmentId) return null;
    const department = await prisma.department.findUnique({ where: { id: requestedDepartmentId } });
    if (!department || department.type !== departmentType) {
      throw new AppError('Department is not valid for this service', 400);
    }
    return department.id;
  }

  const department = await prisma.department.findUnique({ where: { type: user.department.type } });
  if (!department) throw new AppError('User department not found', 403);
  if (requestedDepartmentId && requestedDepartmentId !== department.id) {
    throw new AppError('Access to this department is not allowed', 403);
  }
  return department.id;
};

const getDepartmentScopeId = async (user, requestedDepartmentId, departmentType) => {
  requireDepartmentType(user, departmentType);
  if (user.role === 'SUPER_ADMIN') {
    const department = requestedDepartmentId
      ? await prisma.department.findUnique({ where: { id: requestedDepartmentId } })
      : await prisma.department.findUnique({ where: { type: departmentType } });
    if (!department || department.type !== departmentType) throw new AppError('Department is not valid for this service', 400);
    return department.id;
  }
  return getScopedDepartmentId(user, requestedDepartmentId, departmentType);
};

const assertDepartmentScope = async (user, departmentId, departmentType) => {
  const scopeId = await getDepartmentScopeId(user, null, departmentType);
  if (scopeId !== departmentId) throw new AppError('Access to this department is not allowed', 403);
};

const assertResourceDepartment = (user, departmentId, departmentType) => {
  requireDepartmentType(user, departmentType);
  if (user.role !== 'SUPER_ADMIN' && departmentId !== user.department?.id) {
    // Tokens intentionally only expose the department type. The database relation is
    // checked by callers that need an id-specific comparison.
    throw new AppError('Access to this department is not allowed', 403);
  }
};

const assertDepartmentIdForUser = async (user, departmentId, departmentType) => {
  const scopedDepartmentId = await getScopedDepartmentId(user, departmentId, departmentType);
  if (user.role !== 'SUPER_ADMIN' && scopedDepartmentId !== departmentId) {
    throw new AppError('Access to this department is not allowed', 403);
  }
};

module.exports = {
  requireAuthenticatedUser,
  requireDepartmentType,
  requireCoachAdmin,
  requireCoachOperational,
  getUserAgencyId,
  assertAgencyAccess,
  requireAutomobileAdmin,
  requireConstructionAdmin,
  getScopedDepartmentId,
  getDepartmentScopeId,
  assertDepartmentScope,
  assertDepartmentIdForUser,
};
