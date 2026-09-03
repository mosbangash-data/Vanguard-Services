const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

const SENSITIVE_KEYS = new Set([
  'password', 'passwordhash', 'token', 'resettoken', 'accesstoken', 'refreshtoken',
  'secret', 'apikey', 'databaseurl', 'rawdata', 'stack',
]);

const sanitizeDetails = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeDetails);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !SENSITIVE_KEYS.has(String(key).toLowerCase()))
    .map(([key, entry]) => [key, sanitizeDetails(entry)]));
};

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
  const rec = await prisma.auditLog.create({ data: { action, actorId, details: sanitizeDetails(details) } });
  return rec;
};

const toAuditDto = (logEntry) => ({
  id: logEntry.id,
  action: logEntry.action,
  actorId: logEntry.actorId,
  details: sanitizeDetails(logEntry.details),
  createdAt: logEntry.createdAt,
});

const getLogs = async (query = {}, currentUser) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const where = await buildAuditScope(currentUser);
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.auditLog.count({ where }),
  ]);
  return { items: items.map(toAuditDto), page, limit, total };
};

const getRecentLogs = async (currentUser) => {
  const items = await prisma.auditLog.findMany({ where: await buildAuditScope(currentUser), orderBy: { createdAt: 'desc' }, take: 20 });
  return items.map(toAuditDto);
};

module.exports = { log, getLogs, getRecentLogs };
