const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { requireCoachAdmin, getScopedDepartmentId, assertDepartmentIdForUser } = require('./departmentAccessService');

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

const listAgencies = async (query = {}, currentUser) => {
  requireCoachAdmin(currentUser);

  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const skip = (page - 1) * limit;

  const where = {};
  const departmentId = await getScopedDepartmentId(currentUser, query.departmentId, 'VANGUARD_COACH');
  if (departmentId) where.departmentId = departmentId;
  if (query.search) {
    const s = typeof query.search === 'string' ? query.search.trim() : '';
    if (s) {
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { code: { contains: s, mode: 'insensitive' } },
        { address: { contains: s, mode: 'insensitive' } },
      ];
    }
  }

  const [items, total] = await Promise.all([
    prisma.agency.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.agency.count({ where }),
  ]);

  return { items, page, limit, total };
};

const getAgencyById = async (agencyId, currentUser) => {
  requireCoachAdmin(currentUser);

  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw new AppError('Agency not found', 404);
  await assertDepartmentIdForUser(currentUser, agency.departmentId, 'VANGUARD_COACH');

  return { agency };
};

const createAgency = async (data, currentUser) => {
  requireCoachAdmin(currentUser);

  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
  const requestedDepartmentId = typeof data?.departmentId === 'string' ? data.departmentId : null;
  const departmentId = await getScopedDepartmentId(currentUser, requestedDepartmentId, 'VANGUARD_COACH');
  const address = typeof data?.address === 'string' ? data.address.trim() : null;
  const phone = typeof data?.phone === 'string' ? data.phone.trim() : null;

  if (!name || !code || !departmentId) {
    throw new AppError('name, code and departmentId are required', 400);
  }

  const existing = await prisma.agency.findUnique({ where: { code } });
  if (existing) {
    throw new AppError('Agency code already exists', 409);
  }

  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) throw new AppError('Department not found', 404);

  const agency = await prisma.agency.create({ data: { name, code, departmentId, address, phone } });
  await auditService.log('create_agency', currentUser.id, { targetAgencyId: agency.id, name, code });

  return { agency };
};

const updateAgency = async (agencyId, data, currentUser) => {
  requireCoachAdmin(currentUser);

  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw new AppError('Agency not found', 404);
  await assertDepartmentIdForUser(currentUser, agency.departmentId, 'VANGUARD_COACH');

  const updatePayload = {};
  if (data?.name !== undefined) updatePayload.name = typeof data.name === 'string' ? data.name.trim() : agency.name;
  if (data?.address !== undefined) updatePayload.address = typeof data.address === 'string' && data.address.trim() ? data.address.trim() : null;
  if (data?.phone !== undefined) updatePayload.phone = typeof data.phone === 'string' ? data.phone.trim() : null;
  if (data?.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);

  const updated = await prisma.agency.update({ where: { id: agencyId }, data: updatePayload });
  await auditService.log('update_agency', currentUser.id, { targetAgencyId: agencyId });

  return { agency: updated };
};

const deleteAgency = async (agencyId, currentUser) => {
  requireCoachAdmin(currentUser);

  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw new AppError('Agency not found', 404);
  await assertDepartmentIdForUser(currentUser, agency.departmentId, 'VANGUARD_COACH');

  await prisma.agency.delete({ where: { id: agencyId } });
  await auditService.log('delete_agency', currentUser.id, { targetAgencyId: agencyId });

  return { success: true };
};

module.exports = {
  listAgencies,
  getAgencyById,
  createAgency,
  updateAgency,
  deleteAgency,
};
