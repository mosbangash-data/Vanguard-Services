const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

const {
  runProductionBootstrap,
  getBootstrapConfig,
  superAdminPermissionNames,
} = require('../src/bootstrap/productionBootstrap');

const environment = {
  DATABASE_URL: 'postgresql://localhost/vanguard',
  SUPER_ADMIN_EMAIL: 'Admin@Example.com',
  SUPER_ADMIN_PASSWORD: 'strong-password-1',
};

function createFakePrisma() {
  const state = {
    role: null,
    department: null,
    permissions: new Map(),
    rolePermissions: new Set(),
    user: null,
  };

  const transaction = {
    role: { upsert: async () => (state.role ||= { id: 'role-1', name: 'SUPER_ADMIN' }) },
    department: {
      upsert: async () => (state.department ||= { id: 'department-1', type: 'VANGUARD_COACH' }),
    },
    permission: {
      upsert: async ({ where }) => {
        if (!state.permissions.has(where.name)) state.permissions.set(where.name, { id: `permission-${where.name}` });
        return state.permissions.get(where.name);
      },
    },
    rolePermission: {
      upsert: async ({ where }) => {
        state.rolePermissions.add(`${where.roleId_permissionId.roleId}:${where.roleId_permissionId.permissionId}`);
        return {};
      },
    },
    user: {
      upsert: async ({ where, update, create }) => {
        if (!state.user) state.user = { ...create, id: 'user-1' };
        else if (state.user.email === where.email) state.user = { ...state.user, ...update };
        return state.user;
      },
    },
  };

  return {
    state,
    $transaction: async (callback) => callback(transaction),
  };
}

test('production bootstrap validates all required variables without defaults', () => {
  for (const name of ['DATABASE_URL', 'SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_PASSWORD']) {
    const incomplete = { ...environment };
    delete incomplete[name];
    assert.throws(() => getBootstrapConfig(incomplete), new RegExp(name));
  }
});

test('production bootstrap migrates first, creates an idempotent Super Admin, and rotates its password', async () => {
  const prisma = createFakePrisma();
  const migrations = [];
  const execute = (command, args, options, callback) => {
    migrations.push({ command, args, databaseUrl: options.env.DATABASE_URL });
    callback(null, '', '');
  };

  await runProductionBootstrap(prisma, { environment, execute });
  const firstHash = prisma.state.user.passwordHash;
  const firstUserId = prisma.state.user.id;

  await runProductionBootstrap(prisma, {
    environment: { ...environment, SUPER_ADMIN_PASSWORD: 'strong-password-2' },
    execute,
  });

  assert.deepEqual(migrations[0].args, ['prisma', 'migrate', 'deploy']);
  assert.equal(migrations[0].databaseUrl, environment.DATABASE_URL);
  assert.equal(prisma.state.user.id, firstUserId);
  assert.notEqual(prisma.state.user.passwordHash, firstHash);
  assert.equal(await bcrypt.compare('strong-password-2', prisma.state.user.passwordHash), true);
  assert.equal(prisma.state.user.roleId, 'role-1');
  assert.equal(prisma.state.user.departmentId, 'department-1');
  assert.equal(prisma.state.user.status, 'ACTIVE');
  assert.equal(prisma.state.user.firstLogin, false);
  assert.equal(prisma.state.permissions.size, superAdminPermissionNames.length);
  assert.equal(prisma.state.rolePermissions.size, superAdminPermissionNames.length);
});

test('production bootstrap does not continue when migrations fail', async () => {
  const prisma = createFakePrisma();
  await assert.rejects(
    runProductionBootstrap(prisma, {
      environment,
      execute: (command, args, options, callback) => callback(new Error('migration failed'), '', 'migration failed'),
    }),
    /Database migrations failed/,
  );
  assert.equal(prisma.state.user, null);
});