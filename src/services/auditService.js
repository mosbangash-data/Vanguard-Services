const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

const buildAuditScope = async (currentUser) => {
  if (!currentUser || !['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(currentUser.role)) {
    throw new AppError('Access denied', 403);
  }
  if (currentUser.role === 'SUPER_ADMIN') return {};

  const department = await prisma.department.findUnique({ where: { type: currentUser.department?.type } });
  if (!department) throw new AppError('Access denied', 403);
  return { details: { path: ['departmentId'], equals: department.id } };
};

const log = async (action, actorId, details = {}) => {
  const rec = await prisma.auditLog.create({ data: { action, actorId, details } });
  return rec;
};

const getLogs = async (query = {}, currentUser) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const where = await buildAuditScope(currentUser);
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, page, limit, total };
};

const getRecentLogs = async (currentUser) => prisma.auditLog.findMany({ where: await buildAuditScope(currentUser), orderBy: { createdAt: 'desc' }, take: 20 });

module.exports = { log, getLogs, getRecentLogs };
