const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getExpectedRolePermissions,
  isRoleDepartmentCompatible,
} = require('../src/config/rbac');

test('Coach AGENT role includes operational permissions expected by the RBAC matrix', () => {
  const permissions = getExpectedRolePermissions('AGENT');

  assert.ok(permissions.includes('VIEW_TRIP'));
  assert.ok(permissions.includes('VIEW_RESERVATION'));
  assert.ok(permissions.includes('VIEW_PAYMENT'));
  assert.ok(permissions.includes('SCAN_TICKET'));
  assert.ok(permissions.includes('CREATE_PARCEL'));
  assert.ok(permissions.includes('VIEW_PARCEL'));
  assert.ok(!permissions.includes('DELETE_USER'));
});

test('Role and department compatibility remains strict for coach staff', () => {
  assert.equal(isRoleDepartmentCompatible('AGENT', 'VANGUARD_COACH'), true);
  assert.equal(isRoleDepartmentCompatible('AGENT', 'CONSTRUCTION'), false);
  assert.equal(isRoleDepartmentCompatible('MANAGER', 'VANGUARD_COACH'), true);
  assert.equal(isRoleDepartmentCompatible('SERVICE_ADMIN', 'AUTO_SALES'), true);
});

test('SUPER_ADMIN permissions remain broader than AGENT without being the same set', () => {
  const superAdminPermissions = getExpectedRolePermissions('SUPER_ADMIN');
  const agentPermissions = getExpectedRolePermissions('AGENT');

  assert.ok(superAdminPermissions.length > agentPermissions.length);
  assert.ok(superAdminPermissions.includes('VIEW_USER'));
  assert.ok(agentPermissions.includes('VIEW_TRIP'));
  assert.ok(!agentPermissions.includes('DELETE_USER'));
});
