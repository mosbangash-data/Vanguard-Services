const test = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = require.resolve('../src/config/prisma');
const auditPath = require.resolve('../src/services/auditService');
const prisma = {};
const auditEntries = [];
const originalPrisma = require.cache[prismaPath];
const originalAudit = require.cache[auditPath];
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
require.cache[auditPath] = { id: auditPath, filename: auditPath, loaded: true, exports: { log: async (...entry) => auditEntries.push(entry) } };

const user = { id: 'manager-a', role: 'MANAGER', department: { type: 'VANGUARD_COACH' }, agencyId: 'agency-a' };
const validInput = {
  fullName: 'Marie Kalala',
  jobTitle: 'Bagagiste',
  phone: '+243 812 345 678',
  hireDate: '2024-03-12',
  compensation: '125.50',
  currency: 'USD',
  payFrequency: 'WEEKLY',
};
let staffMember = null;
let agency = { id: 'agency-a' };
let writes = [];
let attendanceRows = new Map();

test.before(() => {
  prisma.department = { findUnique: async () => ({ id: 'coach-department' }) };
  prisma.agency = { findFirst: async ({ where }) => where.id === agency?.id ? agency : null };
  prisma.agencyStaffMember = {
    create: async ({ data }) => {
      writes.push({ method: 'create', data });
      staffMember = { id: 'staff-1', ...data, isActive: true, createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z') };
      return staffMember;
    },
    findFirst: async ({ where }) => where.agencyId === staffMember?.agencyId && where.id === staffMember?.id ? staffMember : null,
    findMany: async ({ where }) => {
      writes.push({ method: 'findMany', where });
      return staffMember && where.agencyId === staffMember.agencyId ? [staffMember] : [];
    },
    count: async () => staffMember ? 1 : 0,
    update: async ({ data }) => {
      writes.push({ method: 'update', data });
      staffMember = { ...staffMember, ...data };
      return staffMember;
    },
  };
  prisma.agencyStaffAttendance = {
    upsert: async ({ where, create, update }) => {
      writes.push({ method: 'upsert', where, create, update });
      const key = `${where.staffMemberId_attendanceDate.staffMemberId}:${where.staffMemberId_attendanceDate.attendanceDate.toISOString().slice(0, 10)}`;
      const current = attendanceRows.get(key);
      const row = current
        ? { ...current, ...update }
        : { id: `attendance-${attendanceRows.size + 1}`, ...create, createdAt: new Date(), updatedAt: new Date() };
      attendanceRows.set(key, row);
      return row;
    },
    findMany: async ({ where }) => [...attendanceRows.values()].filter((row) => row.staffMemberId === where.staffMemberId),
  };
});

test.beforeEach(() => {
  staffMember = null;
  agency = { id: 'agency-a' };
  writes = [];
  attendanceRows = new Map();
  auditEntries.length = 0;
});

test.after(() => {
  if (originalPrisma) require.cache[prismaPath] = originalPrisma;
  else delete require.cache[prismaPath];
  if (originalAudit) require.cache[auditPath] = originalAudit;
  else delete require.cache[auditPath];
});

test('creates a staff member without a User account and derives agency and audit identity from Manager', async () => {
  const service = require('../src/services/agencyStaffService');
  const result = await service.createStaffMember(validInput, user);
  assert.equal(result.staffMember.fullName, validInput.fullName);
  assert.equal(writes[0].data.agencyId, 'agency-a');
  assert.equal(writes[0].data.createdByUserId, 'manager-a');
  assert.equal(writes[0].data.updatedByUserId, 'manager-a');
  assert.equal(writes[0].data.compensation, '125.50');
  assert.equal(auditEntries[0][0], 'create_agency_staff_member');
});

test('rejects malformed required fields, phone, compensation, currency and pay frequency', async () => {
  const service = require('../src/services/agencyStaffService');
  for (const input of [
    { ...validInput, fullName: '  ' },
    { ...validInput, jobTitle: '' },
    { ...validInput, phone: '123' },
    { ...validInput, hireDate: '2026-02-30' },
    { ...validInput, compensation: '-1' },
    { ...validInput, compensation: '1.999' },
    { ...validInput, currency: 'US' },
    { ...validInput, payFrequency: 'YEARLY' },
  ]) {
    await assert.rejects(service.createStaffMember(input, user), { statusCode: 400 });
  }
  assert.equal(writes.some((write) => write.method === 'create'), false);
});

test('rejects forged agency ids and Managers without a valid active Coach agency', async () => {
  const service = require('../src/services/agencyStaffService');
  await assert.rejects(service.createStaffMember({ ...validInput, agencyId: 'agency-b' }, user), { statusCode: 403 });
  await assert.rejects(service.createStaffMember(validInput, { ...user, agencyId: undefined }), { statusCode: 403 });
  agency = null;
  await assert.rejects(service.listStaffMembers({}, user), { statusCode: 403 });
  assert.equal(writes.some((write) => write.method === 'create'), false);
});

test('lists only the authenticated agency and supports name, job title, and active status filters', async () => {
  const service = require('../src/services/agencyStaffService');
  await service.createStaffMember(validInput, user);
  await service.listStaffMembers({ search: 'Marie', jobTitle: 'Bagagiste', isActive: 'true' }, user);
  const query = writes.find((write) => write.method === 'findMany');
  assert.equal(query.where.agencyId, 'agency-a');
  assert.deepEqual(query.where.fullName, { contains: 'Marie', mode: 'insensitive' });
  assert.deepEqual(query.where.jobTitle, { contains: 'Bagagiste', mode: 'insensitive' });
  assert.equal(query.where.isActive, true);
});

test('refuses cross-agency reads and updates by identifier', async () => {
  const service = require('../src/services/agencyStaffService');
  await service.createStaffMember(validInput, user);
  await assert.rejects(service.getStaffMember('staff-from-b', user), { statusCode: 404 });
  await assert.rejects(service.updateStaffMember('staff-from-b', { jobTitle: 'Chef' }, user), { statusCode: 404 });
  assert.equal(writes.some((write) => write.method === 'update'), false);
});

test('updates staff profile fields while retaining the agency and recording the acting Manager', async () => {
  const service = require('../src/services/agencyStaffService');
  await service.createStaffMember(validInput, user);
  await service.updateStaffMember('staff-1', { jobTitle: 'Chef bagagiste', compensation: '140.00', payFrequency: 'MONTHLY' }, user);
  const update = writes.find((write) => write.method === 'update');
  assert.equal(update.data.jobTitle, 'Chef bagagiste');
  assert.equal(update.data.compensation, '140.00');
  assert.equal(update.data.updatedByUserId, 'manager-a');
  assert.equal(Object.hasOwn(update.data, 'agencyId'), false);
});

test('attendance upsert enforces one worker/date row and preserves the original creator', async () => {
  const service = require('../src/services/agencyStaffService');
  await service.createStaffMember(validInput, user);
  await service.upsertAttendance('staff-1', { date: '2026-10-12', status: 'PRESENT' }, user);
  await service.upsertAttendance('staff-1', { date: '2026-10-12', status: 'LEAVE', note: 'Congé autorisé' }, user);
  assert.equal(attendanceRows.size, 1);
  const row = [...attendanceRows.values()][0];
  assert.equal(row.status, 'LEAVE');
  assert.equal(row.createdByUserId, 'manager-a');
  assert.equal(row.updatedByUserId, 'manager-a');
  assert.equal(row.attendanceDate.toISOString(), '2026-10-12T00:00:00.000Z');
  const result = await service.listAttendance('staff-1', {}, user);
  assert.equal(result.attendance.length, 1);
  assert.equal(result.attendance[0].attendanceDate, '2026-10-12');
});

test('deactivation is soft and attendance remains available', async () => {
  const service = require('../src/services/agencyStaffService');
  await service.createStaffMember(validInput, user);
  await service.upsertAttendance('staff-1', { date: '2026-10-11', status: 'ABSENT' }, user);
  await service.updateStaffMemberStatus('staff-1', false, user);
  assert.equal(staffMember.isActive, false);
  assert.equal(attendanceRows.size, 1);
  assert.equal(writes.some((write) => write.method === 'delete'), false);
});

test('Agent, Service Admin and Super Admin do not inherit Manager staff registry access', async () => {
  const service = require('../src/services/agencyStaffService');
  for (const role of ['AGENT', 'SERVICE_ADMIN', 'SUPER_ADMIN']) {
    await assert.rejects(service.listStaffMembers({}, { ...user, role }), { statusCode: 403 });
  }
});
