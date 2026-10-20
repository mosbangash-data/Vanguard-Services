const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { getExpectedRolePermissions } = require('../src/config/rbac');

const modulePaths = {
  env: require.resolve('../src/config/env'),
  prisma: require.resolve('../src/config/prisma'),
  userRepository: require.resolve('../src/services/userRepository'),
  auditService: require.resolve('../src/services/auditService'),
  authService: require.resolve('../src/services/authService'),
};
const originals = Object.fromEntries(Object.entries(modulePaths).map(([key, path]) => [key, require.cache[path]]));

const agent = {
  id: 'agent-user',
  email: 'agent@example.test',
  firstName: 'Coach',
  lastName: 'Agent',
  passwordHash: null,
  status: 'ACTIVE',
  roleId: 'agent-role',
  role: { name: 'AGENT', permissions: [] },
  department: { id: 'coach-dept', type: 'VANGUARD_COACH', name: 'Vanguard Coach' },
  agencyId: 'agency-one',
  agency: { id: 'agency-one', code: 'ONE', name: 'Agency One', city: 'Kinshasa', departmentId: 'coach-dept' },
};
const permissionMappings = getExpectedRolePermissions('AGENT').map((name) => ({ permission: { name } }));
const prisma = {
  rolePermission: { findMany: async () => permissionMappings },
};
const userRepository = {
  findByIdentifier: async () => agent,
  findById: async () => agent,
};
const installMock = (path, exports) => {
  require.cache[path] = { id: path, filename: path, loaded: true, exports };
};

installMock(modulePaths.env, { jwtSecret: 'unit-test-secret', jwtExpiresIn: '8h' });
installMock(modulePaths.prisma, prisma);
installMock(modulePaths.userRepository, userRepository);
installMock(modulePaths.auditService, { log: async () => ({}) });
delete require.cache[modulePaths.authService];
const authService = require('../src/services/authService');

test('login and current profile expose the same filtered permissions and agency context', async () => {
  agent.passwordHash = await bcrypt.hash('Valid-agent-password', 4);
  const loginResult = await authService.login({ identifier: agent.email, password: 'Valid-agent-password' });
  const profileResult = await authService.getCurrentUser(agent.id);

  assert.deepEqual(profileResult.user.permissions, loginResult.user.permissions);
  assert.equal(loginResult.user.role, 'AGENT');
  assert.equal(profileResult.user.agencyId, agent.agencyId);
  assert.ok(loginResult.user.permissions.includes('VIEW_TRIP'));
  assert.ok(loginResult.user.permissions.includes('CREATE_PARCEL'));
  assert.ok(!loginResult.user.permissions.includes('DELETE_USER'));
});

test.after(() => {
  for (const [key, path] of Object.entries(modulePaths)) {
    if (originals[key]) require.cache[path] = originals[key];
    else delete require.cache[path];
  }
});
