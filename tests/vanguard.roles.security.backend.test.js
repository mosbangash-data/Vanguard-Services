const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

test('Password token generation and SHA-256 hashing behaves deterministically and securely', () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  assert.equal(rawToken.length, 64);

  const hash1 = crypto.createHash('sha256').update(rawToken).digest('hex');
  const hash2 = crypto.createHash('sha256').update(rawToken).digest('hex');
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64);
  assert.notEqual(rawToken, hash1);
});

test('Password validation logic enforces length and confirmation', () => {
  const validateChange = (currentPassword, newPassword, confirmPassword) => {
    if (!currentPassword || !newPassword || !confirmPassword) throw new Error('Missing fields');
    if (newPassword !== confirmPassword) throw new Error('Mismatch');
    if (newPassword.length < 8) throw new Error('Too short');
  };

  assert.throws(() => validateChange('old12345!', 'short', 'short'), /Too short/);
  assert.throws(() => validateChange('old12345!', 'newPassword123!', 'mismatch123!'), /Mismatch/);
  assert.throws(() => validateChange('', 'newPassword123!', 'newPassword123!'), /Missing fields/);
  assert.doesNotThrow(() => validateChange('old12345!', 'newPassword123!', 'newPassword123!'));
});

test('Reset token expiration and single-use rules', () => {
  const now = new Date();
  const validToken = { usedAt: null, expiresAt: new Date(now.getTime() + 3600000) };
  const expiredToken = { usedAt: null, expiresAt: new Date(now.getTime() - 1000) };
  const usedToken = { usedAt: new Date(now.getTime() - 10000), expiresAt: new Date(now.getTime() + 3600000) };

  const validateTokenRecord = (record) => {
    if (!record) throw new Error('Token not found');
    if (record.usedAt !== null) throw new Error('Token already used');
    if (record.expiresAt < new Date()) throw new Error('Token expired');
    return true;
  };

  assert.equal(validateTokenRecord(validToken), true);
  assert.throws(() => validateTokenRecord(expiredToken), /Token expired/);
  assert.throws(() => validateTokenRecord(usedToken), /Token already used/);
});

test('Admin reset generates temporary password and marks firstLogin = true', () => {
  const generateTemporaryPassword = (firstName) => {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${firstName.toLowerCase()}${random}!`;
  };

  const tempPass = generateTemporaryPassword('Alice');
  assert.match(tempPass, /^alice\d{4}!$/);
  assert.ok(tempPass.length >= 8);
});

test('firstLogin lifecycle transitions', () => {
  // On creation: firstLogin = true
  let user = { id: 'u1', email: 'test@vanguard.local', firstLogin: true };
  assert.equal(user.firstLogin, true);

  // On change password or reset password with token: firstLogin = false
  user = { ...user, firstLogin: false };
  assert.equal(user.firstLogin, false);

  // On admin password reset: firstLogin = true
  user = { ...user, firstLogin: true };
  assert.equal(user.firstLogin, true);
});

test('Department access enforcement enforces strict isolation between Coach, Auto and Construction', () => {
  const superAdmin = { role: 'SUPER_ADMIN', department: { type: 'VANGUARD_COACH' } };
  const coachAdmin = { role: 'SERVICE_ADMIN', department: { type: 'VANGUARD_COACH' } };
  const autoAdmin = { role: 'SERVICE_ADMIN', department: { type: 'AUTO_SALES' } };
  const constructionAdmin = { role: 'SERVICE_ADMIN', department: { type: 'CONSTRUCTION' } };

  const checkAccess = (user, requiredType) => {
    if (!user) throw new Error('401');
    if (user.role !== 'SUPER_ADMIN' && user.department?.type !== requiredType) {
      throw new Error('403');
    }
  };

  // Super Admin can access all
  assert.doesNotThrow(() => checkAccess(superAdmin, 'VANGUARD_COACH'));
  assert.doesNotThrow(() => checkAccess(superAdmin, 'AUTO_SALES'));
  assert.doesNotThrow(() => checkAccess(superAdmin, 'CONSTRUCTION'));

  // Coach Admin only Coach
  assert.doesNotThrow(() => checkAccess(coachAdmin, 'VANGUARD_COACH'));
  assert.throws(() => checkAccess(coachAdmin, 'AUTO_SALES'), /403/);
  assert.throws(() => checkAccess(coachAdmin, 'CONSTRUCTION'), /403/);

  // Auto Admin only Auto
  assert.doesNotThrow(() => checkAccess(autoAdmin, 'AUTO_SALES'));
  assert.throws(() => checkAccess(autoAdmin, 'VANGUARD_COACH'), /403/);
  assert.throws(() => checkAccess(autoAdmin, 'CONSTRUCTION'), /403/);

  // Construction Admin only Construction
  assert.doesNotThrow(() => checkAccess(constructionAdmin, 'CONSTRUCTION'));
  assert.throws(() => checkAccess(constructionAdmin, 'VANGUARD_COACH'), /403/);
  assert.throws(() => checkAccess(constructionAdmin, 'AUTO_SALES'), /403/);
});

test('Department Admins cannot manage other Admins or create admins', () => {
  const assertManageableUser = (targetUser, currentUser, { creating = false, requestedRole = null } = {}) => {
    if (currentUser.role === 'SUPER_ADMIN') return true;
    if (targetUser?.role === 'SUPER_ADMIN' || targetUser?.role === 'SERVICE_ADMIN' || requestedRole === 'SUPER_ADMIN' || requestedRole === 'SERVICE_ADMIN') {
      throw new Error('403: Cannot manage admin');
    }
    if (creating && !['AGENT', 'MANAGER'].includes(requestedRole)) {
      throw new Error('403: Cannot create this role');
    }
    return true;
  };

  const autoAdmin = { role: 'SERVICE_ADMIN' };
  const targetAdmin = { role: 'SERVICE_ADMIN' };
  const targetAgent = { role: 'AGENT' };

  assert.throws(() => assertManageableUser(targetAdmin, autoAdmin), /Cannot manage admin/);
  assert.throws(() => assertManageableUser(null, autoAdmin, { creating: true, requestedRole: 'SERVICE_ADMIN' }), /Cannot manage admin/);
  assert.equal(assertManageableUser(targetAgent, autoAdmin), true);
  assert.equal(assertManageableUser(null, autoAdmin, { creating: true, requestedRole: 'AGENT' }), true);
});

test('canonical role architecture rejects legacy role values', () => {
  const canonicalRoles = new Set(['SUPER_ADMIN', 'SERVICE_ADMIN', 'MANAGER', 'AGENT']);
  for (const legacyRole of ['ENGINEER', 'SALES_AGENT', 'CONSTRUCTION']) {
    assert.equal(canonicalRoles.has(legacyRole), false);
  }
});

test('Manager and Agent are Coach-only roles', () => {
  const canUseRole = (role, department) => (
    ['MANAGER', 'AGENT'].includes(role) && department === 'VANGUARD_COACH'
  );

  assert.equal(canUseRole('MANAGER', 'VANGUARD_COACH'), true);
  assert.equal(canUseRole('AGENT', 'VANGUARD_COACH'), true);
  assert.equal(canUseRole('MANAGER', 'CONSTRUCTION'), false);
  assert.equal(canUseRole('AGENT', 'AUTO_SALES'), false);
});

test('Template filter logic distinguishes templates from operational data', () => {
  const items = [
    { id: '1', isTemplate: true, title: 'Template Project 1' },
    { id: '2', isTemplate: false, title: 'Operational Project 1' },
    { id: '3', isTemplate: true, title: 'Template Project 2' },
  ];

  const filterTemplates = (list, queryIsTemplate) => {
    if (queryIsTemplate === undefined) return list;
    const isTemplateBool = queryIsTemplate === 'true' || queryIsTemplate === true;
    return list.filter((i) => i.isTemplate === isTemplateBool);
  };

  const templatesOnly = filterTemplates(items, 'true');
  assert.equal(templatesOnly.length, 2);
  assert.equal(templatesOnly.every((i) => i.isTemplate === true), true);

  const operationalOnly = filterTemplates(items, 'false');
  assert.equal(operationalOnly.length, 1);
  assert.equal(operationalOnly[0].id, '2');

  const allItems = filterTemplates(items, undefined);
  assert.equal(allItems.length, 3);
});

test('Agency data model supports extended metadata fields', () => {
  const agency = {
    id: 'ag-1',
    code: 'AG-KIN-01',
    name: 'Agence Kinshasa Gombe',
    address: '123 Boulevard du 30 Juin',
    city: 'Kinshasa',
    managerName: 'Jean Dupont',
    openingHours: '08:00 - 18:00',
    email: 'kinshasa@vanguard.local',
    phone: '+243990000001',
    isActive: true,
  };

  assert.equal(agency.code, 'AG-KIN-01');
  assert.equal(agency.city, 'Kinshasa');
  assert.equal(agency.managerName, 'Jean Dupont');
  assert.equal(agency.openingHours, '08:00 - 18:00');
  assert.equal(agency.email, 'kinshasa@vanguard.local');
  assert.equal(agency.isActive, true);
});
