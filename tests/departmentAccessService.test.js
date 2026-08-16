const test = require('node:test');
const assert = require('node:assert/strict');
const {
  requireDepartmentType,
  requireCoachAdmin,
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
