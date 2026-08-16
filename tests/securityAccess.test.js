const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const prisma = require('../src/config/prisma');
const authService = require('../src/services/authService');
const { buildUserFromToken } = require('../src/middleware/authMiddleware');
const parcelService = require('../src/services/parcelService');
const seatService = require('../src/services/seatService');
const auditService = require('../src/services/auditService');
const notificationService = require('../src/services/notificationService');

const coachAdmin = { id: 'coach-admin', role: 'SERVICE_ADMIN', department: { type: 'VANGUARD_COACH' }, permissions: ['VIEW_RESERVATION'] };
const constructionAdmin = { id: 'construction-admin', role: 'SERVICE_ADMIN', department: { type: 'CONSTRUCTION' }, permissions: ['VIEW_RESERVATION'] };
const autoAdmin = { id: 'auto-admin', role: 'SERVICE_ADMIN', department: { type: 'AUTO_SALES' }, permissions: ['VIEW_RESERVATION'] };
const agent = { id: 'agent', role: 'AGENT', department: { type: 'VANGUARD_COACH' }, permissions: [] };

test('an old JWT is refused when the account is no longer active', async () => {
  const original = authService.getUserForAuth;
  authService.getUserForAuth = async () => ({ id: 'disabled', status: 'INACTIVE', role: { name: 'AGENT', permissions: [] }, department: null });
  const token = jwt.sign({ sub: 'disabled' }, env.jwtSecret, { expiresIn: '1h' });
  await assert.rejects(() => buildUserFromToken(token), { statusCode: 403 });
  authService.getUserForAuth = original;
});

test('parcels allow Transport administration and reject Construction and Automobile', async () => {
  const originalFindMany = prisma.parcel.findMany;
  const originalCount = prisma.parcel.count;
  prisma.parcel.findMany = async () => [];
  prisma.parcel.count = async () => 0;
  await assert.doesNotReject(() => parcelService.listParcels({}, coachAdmin));
  await assert.rejects(() => parcelService.listParcels({}, constructionAdmin), { statusCode: 403 });
  await assert.rejects(() => parcelService.listParcels({}, autoAdmin), { statusCode: 403 });
  prisma.parcel.findMany = originalFindMany;
  prisma.parcel.count = originalCount;
});

test('seats allow Transport and reject Construction and Automobile', async () => {
  const originalBus = prisma.bus.findUnique;
  const originalDepartment = prisma.department.findUnique;
  prisma.bus.findUnique = async () => ({ id: 'bus-1', seats: 2, departmentId: 'coach-department' });
  prisma.department.findUnique = async () => ({ id: 'coach-department', type: 'VANGUARD_COACH' });
  await assert.doesNotReject(() => seatService.listSeatsForBus('bus-1', null, coachAdmin));
  await assert.rejects(() => seatService.listSeatsForBus('bus-1', null, constructionAdmin), { statusCode: 403 });
  await assert.rejects(() => seatService.listSeatsForBus('bus-1', null, autoAdmin), { statusCode: 403 });
  prisma.bus.findUnique = originalBus;
  prisma.department.findUnique = originalDepartment;
});

test('agents cannot read audit logs or notify another user', async () => {
  await assert.rejects(() => auditService.getLogs({}, agent), { statusCode: 403 });
  await assert.rejects(() => notificationService.createNotification({ userId: 'other-user', title: 'x', message: 'x' }, agent), { statusCode: 403 });
});

test('a service administrator audit query is constrained to its department', async () => {
  const originalDepartment = prisma.department.findUnique;
  const originalFindMany = prisma.auditLog.findMany;
  const originalCount = prisma.auditLog.count;
  let where;
  prisma.department.findUnique = async () => ({ id: 'coach-department', type: 'VANGUARD_COACH' });
  prisma.auditLog.findMany = async (args) => { where = args.where; return []; };
  prisma.auditLog.count = async () => 0;
  await auditService.getLogs({}, coachAdmin);
  assert.deepEqual(where, { details: { path: ['departmentId'], equals: 'coach-department' } });
  prisma.department.findUnique = originalDepartment;
  prisma.auditLog.findMany = originalFindMany;
  prisma.auditLog.count = originalCount;
});
