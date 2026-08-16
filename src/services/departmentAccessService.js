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
  getScopedDepartmentId,
  assertDepartmentIdForUser,
};
