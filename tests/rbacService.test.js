const test = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = require.resolve('../src/config/prisma');
const rbacServicePath = require.resolve('../src/services/rbacService');
const originalPrisma = require.cache[prismaPath];
const originalService = require.cache[rbacServicePath];
const transactionCalls = [];
let existingMappings = [{ permissionId: 'custom-permission' }];
const rolePermission = {
  findMany: async () => existingMappings,
  upsert: (args) => ({ operation: 'upsert', args }),
  deleteMany: () => { throw new Error('Role synchronization must not erase configured permissions'); },
};
const prisma = {
  role: { findUnique: async () => ({ id: 'role-agent' }) },
  permission: { findMany: async ({ where }) => where.name.in.map((name) => ({ id: `id:${name}`, name })) },
  rolePermission,
  $transaction: async (operations) => { transactionCalls.push(operations); },
};

require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
delete require.cache[rbacServicePath];
const { syncRolePermissionsForRole } = require('../src/services/rbacService');

test('role permission default synchronization keeps explicit permission assignments', async () => {
  const result = await syncRolePermissionsForRole('AGENT', prisma);

  assert.equal(result.synced, true);
  assert.equal(result.removed, 0);
  assert.equal(transactionCalls.length, 1);
  assert.ok(transactionCalls[0].every((operation) => operation.operation === 'upsert'));
});

test('missing AGENT role mappings are restored additively from the default permission set', async () => {
  existingMappings = [];
  transactionCalls.length = 0;

  const result = await syncRolePermissionsForRole('AGENT', prisma);

  assert.equal(result.synced, true);
  assert.equal(result.removed, 0);
  assert.equal(result.added, result.permissions.length);
  assert.equal(transactionCalls.length, 1);
  assert.equal(transactionCalls[0].length, result.permissions.length);
  assert.ok(transactionCalls[0].every((operation) => operation.operation === 'upsert'));
});

test.after(() => {
  if (originalPrisma) require.cache[prismaPath] = originalPrisma;
  else delete require.cache[prismaPath];
  if (originalService) require.cache[rbacServicePath] = originalService;
  else delete require.cache[rbacServicePath];
});
