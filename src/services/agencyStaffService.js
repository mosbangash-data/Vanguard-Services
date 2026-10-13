const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { requireCoachOperational, getUserAgencyId } = require('./departmentAccessService');
const { parseDateKey } = require('../utils/businessTime');

const PAY_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'];
const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LEAVE'];
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]*$/;

const assertManager = (user) => {
  if (!user || user.role !== 'MANAGER') throw new AppError('Access denied', 403);
  requireCoachOperational(user);
};

const getManagerAgencyId = async (user) => {
  assertManager(user);
  const agencyId = getUserAgencyId(user);
  if (!agencyId) throw new AppError('Manager agency assignment is required', 403);

  const department = await prisma.department.findUnique({
    where: { type: 'VANGUARD_COACH' },
    select: { id: true },
  });
  if (!department) throw new AppError('Vanguard Coach department not found', 403);

  const agency = await prisma.agency.findFirst({
    where: { id: agencyId, departmentId: department.id, isActive: true },
    select: { id: true },
  });
  if (!agency) throw new AppError('Manager agency is invalid or inactive', 403);
  return agency.id;
};

const normalizeDate = (value, fieldName) => {
  if (!parseDateKey(value)) throw new AppError(`${fieldName} must be a valid YYYY-MM-DD date`, 400);
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const dateKey = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : value;

const normalizePhone = (value) => {
  const phone = typeof value === 'string' ? value.trim() : '';
  const digits = phone.replace(/\D/g, '');
  if (!PHONE_PATTERN.test(phone) || digits.length < 7 || digits.length > 15) {
    throw new AppError('A valid phone number is required', 400);
  }
  return phone;
};

const normalizeCompensation = (value) => {
  const amount = typeof value === 'number' || typeof value === 'string' ? String(value).trim() : '';
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    throw new AppError('Compensation must be a positive amount with at most two decimal places', 400);
  }
  return Number(amount).toFixed(2);
};

const normalizeCurrency = (value) => {
  const currency = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(currency)) throw new AppError('Currency must be a three-letter code', 400);
  return currency;
};

const normalizeWorkerInput = (data, { partial = false } = {}) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('Invalid staff data', 400);
  const normalized = {};
  const setText = (field, label, maxLength) => {
    if (partial && !Object.hasOwn(data, field)) return;
    const value = typeof data[field] === 'string' ? data[field].trim() : '';
    if (!value || value.length > maxLength) throw new AppError(`${label} is required and must be at most ${maxLength} characters`, 400);
    normalized[field] = value;
  };

  setText('fullName', 'Full name', 120);
  setText('jobTitle', 'Job title', 100);
  if (!partial || Object.hasOwn(data, 'phone')) normalized.phone = normalizePhone(data.phone);
  if (!partial || Object.hasOwn(data, 'hireDate')) normalized.hireDate = normalizeDate(data.hireDate, 'hireDate');
  if (!partial || Object.hasOwn(data, 'compensation')) normalized.compensation = normalizeCompensation(data.compensation);
  if (!partial || Object.hasOwn(data, 'currency')) normalized.currency = normalizeCurrency(data.currency);
  if (!partial || Object.hasOwn(data, 'payFrequency')) {
    if (!PAY_FREQUENCIES.includes(data.payFrequency)) throw new AppError(`payFrequency must be one of ${PAY_FREQUENCIES.join(', ')}`, 400);
    normalized.payFrequency = data.payFrequency;
  }
  return normalized;
};

const assertAgencyNotForged = (data, agencyId) => {
  if (Object.hasOwn(data || {}, 'agencyId') && data.agencyId !== agencyId) {
    throw new AppError('Staff agency is determined by the authenticated Manager', 403);
  }
};

const assertStaffMember = async (id, agencyId) => {
  const member = await prisma.agencyStaffMember.findFirst({ where: { id, agencyId } });
  if (!member) throw new AppError('Staff member not found', 404);
  return member;
};

const toStaffDto = (member) => ({
  id: member.id,
  fullName: member.fullName,
  jobTitle: member.jobTitle,
  phone: member.phone,
  hireDate: dateKey(member.hireDate),
  compensation: String(member.compensation),
  currency: member.currency,
  payFrequency: member.payFrequency,
  isActive: member.isActive,
  createdAt: member.createdAt,
  updatedAt: member.updatedAt,
});

const toAttendanceDto = (attendance) => ({
  id: attendance.id,
  attendanceDate: dateKey(attendance.attendanceDate),
  status: attendance.status,
  note: attendance.note,
  createdAt: attendance.createdAt,
  updatedAt: attendance.updatedAt,
});

const listStaffMembers = async (query = {}, user) => {
  const agencyId = await getManagerAgencyId(user);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
  const where = { agencyId };
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const jobTitle = typeof query.jobTitle === 'string' ? query.jobTitle.trim() : '';
  if (search) where.fullName = { contains: search, mode: 'insensitive' };
  if (jobTitle) where.jobTitle = { contains: jobTitle, mode: 'insensitive' };
  if (query.isActive !== undefined) {
    if (!['true', 'false', true, false].includes(query.isActive)) throw new AppError('isActive must be true or false', 400);
    where.isActive = query.isActive === true || query.isActive === 'true';
  }
  const [items, total] = await Promise.all([
    prisma.agencyStaffMember.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }] }),
    prisma.agencyStaffMember.count({ where }),
  ]);
  return { items: items.map(toStaffDto), page, limit, total };
};

const createStaffMember = async (data, user) => {
  const agencyId = await getManagerAgencyId(user);
  assertAgencyNotForged(data, agencyId);
  const fields = normalizeWorkerInput(data);
  const member = await prisma.agencyStaffMember.create({
    data: { ...fields, agencyId, createdByUserId: user.id, updatedByUserId: user.id },
  });
  await auditService.log('create_agency_staff_member', user.id, { agencyId, staffMemberId: member.id });
  return { staffMember: toStaffDto(member) };
};

const getStaffMember = async (id, user) => {
  const agencyId = await getManagerAgencyId(user);
  const member = await assertStaffMember(id, agencyId);
  return { staffMember: toStaffDto(member) };
};

const updateStaffMember = async (id, data, user) => {
  const agencyId = await getManagerAgencyId(user);
  assertAgencyNotForged(data, agencyId);
  await assertStaffMember(id, agencyId);
  const fields = normalizeWorkerInput(data, { partial: true });
  if (!Object.keys(fields).length) throw new AppError('No staff fields provided for update', 400);
  const member = await prisma.agencyStaffMember.update({
    where: { id },
    data: { ...fields, updatedByUserId: user.id },
  });
  await auditService.log('update_agency_staff_member', user.id, { agencyId, staffMemberId: id });
  return { staffMember: toStaffDto(member) };
};

const updateStaffMemberStatus = async (id, isActive, user) => {
  const agencyId = await getManagerAgencyId(user);
  if (typeof isActive !== 'boolean') throw new AppError('isActive must be a boolean', 400);
  await assertStaffMember(id, agencyId);
  const member = await prisma.agencyStaffMember.update({ where: { id }, data: { isActive, updatedByUserId: user.id } });
  await auditService.log('set_agency_staff_member_status', user.id, { agencyId, staffMemberId: id, isActive });
  return { staffMember: toStaffDto(member) };
};

const listAttendance = async (id, query = {}, user) => {
  const agencyId = await getManagerAgencyId(user);
  await assertStaffMember(id, agencyId);
  const where = { staffMemberId: id };
  if (query.date !== undefined) where.attendanceDate = normalizeDate(query.date, 'date');
  else if (query.from !== undefined || query.to !== undefined) {
    where.attendanceDate = {
      ...(query.from !== undefined ? { gte: normalizeDate(query.from, 'from') } : {}),
      ...(query.to !== undefined ? { lte: normalizeDate(query.to, 'to') } : {}),
    };
  }
  const limit = Math.min(180, Math.max(1, Number(query.limit) || 90));
  const attendance = await prisma.agencyStaffAttendance.findMany({ where, orderBy: { attendanceDate: 'desc' }, take: limit });
  return { attendance: attendance.map(toAttendanceDto) };
};

const upsertAttendance = async (id, data, user) => {
  const agencyId = await getManagerAgencyId(user);
  await assertStaffMember(id, agencyId);
  if (!data || !ATTENDANCE_STATUSES.includes(data.status)) {
    throw new AppError(`status must be one of ${ATTENDANCE_STATUSES.join(', ')}`, 400);
  }
  const attendanceDate = normalizeDate(data.date, 'date');
  const note = data.note === undefined || data.note === null || data.note === ''
    ? null
    : typeof data.note === 'string' && data.note.trim().length <= 500
      ? data.note.trim()
      : (() => { throw new AppError('note must be at most 500 characters', 400); })();
  const attendance = await prisma.agencyStaffAttendance.upsert({
    where: { staffMemberId_attendanceDate: { staffMemberId: id, attendanceDate } },
    create: { staffMemberId: id, attendanceDate, status: data.status, note, createdByUserId: user.id, updatedByUserId: user.id },
    update: { status: data.status, note, updatedByUserId: user.id },
  });
  await auditService.log('upsert_agency_staff_attendance', user.id, { agencyId, staffMemberId: id, attendanceDate: dateKey(attendanceDate), status: data.status });
  return { attendance: toAttendanceDto(attendance) };
};

module.exports = {
  listStaffMembers,
  createStaffMember,
  getStaffMember,
  updateStaffMember,
  updateStaffMemberStatus,
  listAttendance,
  upsertAttendance,
};
