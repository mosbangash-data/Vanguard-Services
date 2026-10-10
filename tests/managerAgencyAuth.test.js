const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const prismaPath = require.resolve('../src/config/prisma');
const prismaModule = { agency: { findFirst: async () => null } };
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaModule };
let currentUser;
const authServicePath = require.resolve('../src/services/authService');
require.cache[authServicePath] = { id: authServicePath, filename: authServicePath, loaded: true, exports: { getUserForAuth: async () => currentUser } };
const rbacServicePath = require.resolve('../src/services/rbacService');
require.cache[rbacServicePath] = { id: rbacServicePath, filename: rbacServicePath, loaded: true, exports: { syncRolePermissionsForRole: async () => {} } };
const { buildUserFromToken } = require('../src/middleware/authMiddleware');
const secret = process.env.JWT_SECRET;
const token = jwt.sign({ sub: 'manager-1' }, secret);
const coachUser = () => ({ id: 'manager-1', status: 'ACTIVE', role: { name: 'MANAGER', permissions: [] }, department: { id: 'coach-dept', type: 'VANGUARD_COACH', name: 'Coach' }, agencyId: 'agency-a', agency: { id: 'agency-a', departmentId: 'coach-dept', code: 'A', name: 'Agency A' } });

test('Manager authentication refuses a missing agency before hydrating an operational identity', async () => {
  currentUser = { ...coachUser(), agencyId: null, agency: null };
  await assert.rejects(buildUserFromToken(token), { statusCode: 403 });
});

test('Manager authentication refuses an inactive or out-of-department agency', async () => {
  currentUser = coachUser();
  let query;
  prismaModule.agency.findFirst = async (args) => { query = args; return null; };
  await assert.rejects(buildUserFromToken(token), { statusCode: 403 });
  assert.deepEqual(query.where, { id: 'agency-a', departmentId: 'coach-dept', isActive: true });
});

test('Manager authentication keeps the authenticated agency identity after validation', async () => {
  currentUser = coachUser();
  prismaModule.agency.findFirst = async ({ where }) => ({ id: where.id });
  const user = await buildUserFromToken(token);
  assert.equal(user.role, 'MANAGER');
  assert.equal(user.agencyId, 'agency-a');
  assert.deepEqual(user.permissions, []);
});
