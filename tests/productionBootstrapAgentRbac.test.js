const test = require('node:test');
const assert = require('node:assert/strict');

const rbacServicePath = require.resolve('../src/services/rbacService');
const bootstrapPath = require.resolve('../src/bootstrap/productionBootstrap');
const originalRbacService = require.cache[rbacServicePath];
const originalBootstrap = require.cache[bootstrapPath];
const syncCalls = [];

require.cache[rbacServicePath] = {
  id: rbacServicePath,
  filename: rbacServicePath,
  loaded: true,
  exports: {
    syncRolePermissionsForRole: async (...args) => { syncCalls.push(args); },
  },
};
delete require.cache[bootstrapPath];
const { runProductionBootstrap, superAdminPermissionNames } = require('../src/bootstrap/productionBootstrap');
const { getExpectedRolePermissions } = require('../src/config/rbac');

test('production bootstrap synchronizes Agent defaults after roles and permissions are bootstrapped', async () => {
  assert.ok(getExpectedRolePermissions('AGENT').every((name) => superAdminPermissionNames.includes(name)));

  const prisma = {
    $transaction: async (callback) => callback({
      role: { upsert: async ({ where }) => ({ id: `role:${where.name}` }) },
      department: { upsert: async ({ where }) => ({ id: `department:${where.type}` }) },
      permission: { upsert: async ({ where }) => ({ id: `permission:${where.name}` }) },
      rolePermission: { upsert: async () => ({}) },
      user: { upsert: async () => ({}) },
    }),
  };
  const execute = (_command, _args, _options, callback) => callback(null, '', '');

  await runProductionBootstrap(prisma, {
    environment: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      SUPER_ADMIN_EMAIL: 'admin@example.test',
      SUPER_ADMIN_PASSWORD: 'test-password',
    },
    execute,
  });

  assert.equal(syncCalls.length, 1);
  assert.equal(syncCalls[0][0], 'AGENT');
  assert.equal(syncCalls[0][1], prisma);
});

test.after(() => {
  if (originalRbacService) require.cache[rbacServicePath] = originalRbacService;
  else delete require.cache[rbacServicePath];
  if (originalBootstrap) require.cache[bootstrapPath] = originalBootstrap;
  else delete require.cache[bootstrapPath];
});
