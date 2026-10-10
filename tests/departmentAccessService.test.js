const test = require('node:test');
const assert = require('node:assert/strict');
const {
  requireDepartmentType,
  requireCoachAdmin,
  assertAgencyAccess,
} = require('../src/services/departmentAccessService');

const coachAdmin = { role: 'SERVICE_ADMIN', department: { type: 'VANGUARD_COACH' }, permissions: [] };
const constructionAdmin = { role: 'SERVICE_ADMIN', department: { type: 'CONSTRUCTION' }, permissions: [] };
const coachAgent = { role: 'AGENT', department: { type: 'VANGUARD_COACH' }, permissions: [] };

test('a transport service administrator has transport scope only', () => {
  assert.doesNotThrow(() => requireCoachAdmin(coachAdmin));
  assert.throws(() => requireDepartmentType(coachAdmin, 'CONSTRUCTION'), { statusCode: 403 });
});

test('a construction service administrator cannot use transport administration', () => {
  assert.throws(() => requireCoachAdmin(constructionAdmin), { statusCode: 403 });
});

test('a transport agent is not elevated to transport administrator', () => {
  assert.throws(() => requireCoachAdmin(coachAgent), { statusCode: 403 });
});

test('a manager can access only the agency assigned to the authenticated identity', () => {
  const manager = { role: 'MANAGER', agencyId: 'agency-a', department: { type: 'VANGUARD_COACH' } };
  assert.doesNotThrow(() => assertAgencyAccess(manager, 'agency-a'));
  assert.throws(() => assertAgencyAccess(manager, 'agency-b'), { statusCode: 403 });
  assert.throws(() => assertAgencyAccess({ ...manager, agencyId: null }, 'agency-a'), { statusCode: 403 });
});

test('an agent remains limited to its agency and Service Admin keeps department-wide agency access', () => {
  const agent = { role: 'AGENT', agencyId: 'agency-a', department: { type: 'VANGUARD_COACH' } };
  assert.doesNotThrow(() => assertAgencyAccess(agent, 'agency-a'));
  assert.throws(() => assertAgencyAccess(agent, 'agency-b'), { statusCode: 403 });
  const serviceAdmin = { role: 'SERVICE_ADMIN', department: { type: 'VANGUARD_COACH' } };
  assert.doesNotThrow(() => assertAgencyAccess(serviceAdmin, 'agency-b'));
});
