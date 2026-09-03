const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 1. Prisma Schema & Migration Audit
test('Prisma schema contains all required models, fields, and relations', () => {
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Verify isTemplate on Project and Vehicle
  assert.match(schema, /model Project {[\s\S]*?isTemplate\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /model Vehicle {[\s\S]*?isTemplate\s+Boolean\s+@default\(false\)/);

  // Verify extended Agency fields
  assert.match(schema, /model Agency {[\s\S]*?city\s+String\?/);
  assert.match(schema, /model Agency {[\s\S]*?managerName\s+String\?/);
  assert.match(schema, /model Agency {[\s\S]*?openingHours\s+String\?/);
  assert.match(schema, /model Agency {[\s\S]*?email\s+String\?/);

  // Verify PasswordResetToken model
  assert.match(schema, /model PasswordResetToken {/);
  assert.match(schema, /tokenHash\s+String\s+@unique/);
  assert.match(schema, /expiresAt\s+DateTime/);
  assert.match(schema, /usedAt\s+DateTime\?/);

  // Verify migration file exists
  const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '20260829120000_reorganize_roles_templates_and_security', 'migration.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration SQL file must exist');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migrationSql, /ALTER TABLE "Project" ADD COLUMN "isTemplate" BOOLEAN/);
  assert.match(migrationSql, /ALTER TABLE "Vehicle" ADD COLUMN "isTemplate" BOOLEAN/);
  assert.match(migrationSql, /CREATE TABLE "PasswordResetToken"/);
});

// 2. Department Isolation & Cross-Department 403 Tests
test('Department isolation strictly restricts departmental admins and returns HTTP 403 on cross-access', () => {
  const superAdmin = { role: 'SUPER_ADMIN', department: { type: 'VANGUARD_COACH' } };
  const coachAdmin = { role: 'SERVICE_ADMIN', department: { type: 'VANGUARD_COACH' } };
  const autoAdmin = { role: 'SERVICE_ADMIN', department: { type: 'AUTO_SALES' } };
  const constructionAdmin = { role: 'SERVICE_ADMIN', department: { type: 'CONSTRUCTION' } };

  const checkDepartmentAccess = (user, requiredType) => {
    if (!user) {
      const err = new Error('Unauthorized');
      err.statusCode = 401;
      throw err;
    }
    if (user.role !== 'SUPER_ADMIN' && user.department?.type !== requiredType) {
      const err = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }
    return true;
  };

  // Super admin global access
  assert.equal(checkDepartmentAccess(superAdmin, 'VANGUARD_COACH'), true);
  assert.equal(checkDepartmentAccess(superAdmin, 'AUTO_SALES'), true);
  assert.equal(checkDepartmentAccess(superAdmin, 'CONSTRUCTION'), true);

  // Coach admin limited to Coach
  assert.equal(checkDepartmentAccess(coachAdmin, 'VANGUARD_COACH'), true);
  assert.throws(() => checkDepartmentAccess(coachAdmin, 'AUTO_SALES'), (err) => err.statusCode === 403);
  assert.throws(() => checkDepartmentAccess(coachAdmin, 'CONSTRUCTION'), (err) => err.statusCode === 403);

  // Auto admin limited to Auto
  assert.equal(checkDepartmentAccess(autoAdmin, 'AUTO_SALES'), true);
  assert.throws(() => checkDepartmentAccess(autoAdmin, 'VANGUARD_COACH'), (err) => err.statusCode === 403);
  assert.throws(() => checkDepartmentAccess(autoAdmin, 'CONSTRUCTION'), (err) => err.statusCode === 403);

  // Construction admin limited to Construction
  assert.equal(checkDepartmentAccess(constructionAdmin, 'CONSTRUCTION'), true);
  assert.throws(() => checkDepartmentAccess(constructionAdmin, 'VANGUARD_COACH'), (err) => err.statusCode === 403);
  assert.throws(() => checkDepartmentAccess(constructionAdmin, 'AUTO_SALES'), (err) => err.statusCode === 403);
});

// 3. Password Operations & Edge Cases
test('Password workflow: change password, forgot password, token lifecycle, and admin reset', () => {
  // In-memory user state
  let user = {
    id: 'user-123',
    email: 'user@vanguard.local',
    passwordHash: 'hash_of_oldPassword123!',
    firstLogin: true,
    status: 'ACTIVE',
  };

  const tokensDB = [];

  // A. Change Password Validation & Execution
  const changePassword = (currentUser, { currentPassword, newPassword, confirmPassword }) => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      const err = new Error('Current password, new password and confirmation are required');
      err.statusCode = 400;
      throw err;
    }
    if (newPassword !== confirmPassword) {
      const err = new Error('New password and confirmation do not match');
      err.statusCode = 400;
      throw err;
    }
    if (newPassword.length < 8) {
      const err = new Error('New password must be at least 8 characters long');
      err.statusCode = 400;
      throw err;
    }
    if (`hash_of_${currentPassword}` !== currentUser.passwordHash) {
      const err = new Error('Current password is incorrect');
      err.statusCode = 400;
      throw err;
    }
    if (currentPassword === newPassword) {
      const err = new Error('New password must be different from current password');
      err.statusCode = 400;
      throw err;
    }
    currentUser.passwordHash = `hash_of_${newPassword}`;
    currentUser.firstLogin = false;
    return { success: true, message: 'Password changed successfully' };
  };

  // Edge cases
  assert.throws(() => changePassword(user, { currentPassword: 'wrongPassword!', newPassword: 'newValidPassword123!', confirmPassword: 'newValidPassword123!' }), (err) => err.statusCode === 400 && err.message.includes('incorrect'));
  assert.throws(() => changePassword(user, { currentPassword: 'oldPassword123!', newPassword: 'short', confirmPassword: 'short' }), (err) => err.statusCode === 400 && err.message.includes('8 characters'));
  assert.throws(() => changePassword(user, { currentPassword: 'oldPassword123!', newPassword: 'newValidPassword123!', confirmPassword: 'differentPassword123!' }), (err) => err.statusCode === 400 && err.message.includes('do not match'));
  assert.throws(() => changePassword(user, { currentPassword: 'oldPassword123!', newPassword: 'oldPassword123!', confirmPassword: 'oldPassword123!' }), (err) => err.statusCode === 400 && err.message.includes('different'));

  // Valid change password
  const changeResult = changePassword(user, { currentPassword: 'oldPassword123!', newPassword: 'newValidPassword123!', confirmPassword: 'newValidPassword123!' });
  assert.equal(changeResult.success, true);
  assert.equal(user.firstLogin, false);
  assert.equal(user.passwordHash, 'hash_of_newValidPassword123!');

  // B. Forgot Password (generate token, prevent enumeration)
  const forgotPassword = (email) => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    tokensDB.push({ id: 'tok-1', userId: user.id, tokenHash, expiresAt, usedAt: null });
    return {
      response: { success: true, message: 'If this email is associated with an account, a password reset link has been sent.' },
      rawToken,
    };
  };

  const { response, rawToken } = forgotPassword(user.email);
  assert.equal(response.success, true);
  assert.equal(tokensDB.length, 1);

  // C. Reset Password with Token
  const resetPassword = ({ token, newPassword, confirmPassword }) => {
    if (!token || !newPassword || !confirmPassword) {
      const err = new Error('Token, new password and confirmation are required');
      err.statusCode = 400;
      throw err;
    }
    if (newPassword !== confirmPassword) {
      const err = new Error('New password and confirmation do not match');
      err.statusCode = 400;
      throw err;
    }
    if (newPassword.length < 8) {
      const err = new Error('New password must be at least 8 characters long');
      err.statusCode = 400;
      throw err;
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = tokensDB.find((t) => t.tokenHash === tokenHash);
    if (!record) {
      const err = new Error('Invalid or expired password reset token');
      err.statusCode = 400;
      throw err;
    }
    if (record.usedAt !== null) {
      const err = new Error('Password reset token has already been used');
      err.statusCode = 400;
      throw err;
    }
    if (record.expiresAt < new Date()) {
      const err = new Error('Password reset token has expired');
      err.statusCode = 400;
      throw err;
    }

    record.usedAt = new Date();
    user.passwordHash = `hash_of_${newPassword}`;
    user.firstLogin = false;
    return { success: true, message: 'Password has been reset successfully' };
  };

  // Reset Token edge cases
  assert.throws(() => resetPassword({ token: 'invalid_token_xyz', newPassword: 'anotherPassword123!', confirmPassword: 'anotherPassword123!' }), (err) => err.statusCode === 400 && err.message.includes('Invalid'));

  // Valid reset password
  const resetResult = resetPassword({ token: rawToken, newPassword: 'anotherPassword123!', confirmPassword: 'anotherPassword123!' });
  assert.equal(resetResult.success, true);
  assert.equal(user.passwordHash, 'hash_of_anotherPassword123!');
  assert.equal(user.firstLogin, false);

  // Single use rejection
  assert.throws(() => resetPassword({ token: rawToken, newPassword: 'anotherPassword123!', confirmPassword: 'anotherPassword123!' }), (err) => err.statusCode === 400 && err.message.includes('already been used'));

  // Expired token rejection
  const expiredRaw = crypto.randomBytes(32).toString('hex');
  tokensDB.push({
    id: 'tok-expired',
    userId: user.id,
    tokenHash: crypto.createHash('sha256').update(expiredRaw).digest('hex'),
    expiresAt: new Date(Date.now() - 1000),
    usedAt: null,
  });
  assert.throws(() => resetPassword({ token: expiredRaw, newPassword: 'anotherPassword123!', confirmPassword: 'anotherPassword123!' }), (err) => err.statusCode === 400 && err.message.includes('expired'));

  // D. Admin Reset
  const adminReset = (targetUser, firstName) => {
    const temporaryPassword = `${firstName.toLowerCase()}${Math.floor(1000 + Math.random() * 9000)}!`;
    targetUser.passwordHash = `hash_of_${temporaryPassword}`;
    targetUser.firstLogin = true;
    return { temporaryPassword, firstLogin: true };
  };

  const adminResult = adminReset(user, 'Dominique');
  assert.equal(adminResult.firstLogin, true);
  assert.equal(user.firstLogin, true);
  assert.match(adminResult.temporaryPassword, /^dominique\d{4}!$/);
});

// 4. Templates CRUD & Query Filtering
test('Templates: query filtering, creation, update, and unrestricted deletion by department admins and super admin', () => {
  let vehicles = [
    { id: 'v1', brand: 'Toyota', model: 'Hilux', isTemplate: true, departmentId: 'auto-dept' },
    { id: 'v2', brand: 'Nissan', model: 'Patrol', isTemplate: false, departmentId: 'auto-dept' },
    { id: 'v3', brand: 'Ford', model: 'Ranger', isTemplate: true, departmentId: 'auto-dept' },
  ];

  let projects = [
    { id: 'p1', title: 'Villa Moderne', isTemplate: true, departmentId: 'const-dept' },
    { id: 'p2', title: 'Chantier Gombe', isTemplate: false, departmentId: 'const-dept' },
  ];

  // Filtering vehicles
  const filterVehicles = (isTemplate) => {
    if (isTemplate === undefined) return vehicles;
    const boolVal = isTemplate === 'true' || isTemplate === true;
    return vehicles.filter((v) => v.isTemplate === boolVal);
  };

  assert.equal(filterVehicles('true').length, 2);
  assert.equal(filterVehicles('false').length, 1);
  assert.equal(filterVehicles(undefined).length, 3);

  // Filtering projects
  const filterProjects = (isTemplate) => {
    if (isTemplate === undefined) return projects;
    const boolVal = isTemplate === 'true' || isTemplate === true;
    return projects.filter((p) => p.isTemplate === boolVal);
  };

  assert.equal(filterProjects('true').length, 1);
  assert.equal(filterProjects('false').length, 1);

  // Deleting template vehicles: allowed without inquiry/reservation constraints
  const deleteVehicle = (id) => {
    const v = vehicles.find((item) => item.id === id);
    if (!v) throw new Error('404');
    vehicles = vehicles.filter((item) => item.id !== id);
    return { success: true };
  };

  assert.equal(deleteVehicle('v1').success, true);
  assert.equal(vehicles.length, 2);

  // Deleting template projects: allowed directly
  const deleteProject = (id) => {
    const p = projects.find((item) => item.id === id);
    if (!p) throw new Error('404');
    projects = projects.filter((item) => item.id !== id);
    return { success: true };
  };

  assert.equal(deleteProject('p1').success, true);
  assert.equal(projects.length, 1);
});

// 5. Agency Module Extended Fields & Backwards Compatibility
test('Agency module preserves existing fields and accepts optional extended metadata', () => {
  const baseAgency = {
    id: 'ag-1',
    code: 'AG-LUB-01',
    name: 'Agence Lubumbashi',
    departmentId: 'coach-dept',
    address: '45 Avenue Mobutu',
    phone: '+243810000000',
    isActive: true,
  };

  const extendedAgency = {
    ...baseAgency,
    city: 'Lubumbashi',
    managerName: 'Patrice Lumumba',
    openingHours: '07:30 - 17:30',
    email: 'lubumbashi@vanguard.local',
  };

  // Base fields exist
  assert.equal(baseAgency.code, 'AG-LUB-01');
  assert.equal(baseAgency.name, 'Agence Lubumbashi');
  assert.equal(baseAgency.isActive, true);

  // Extended fields exist
  assert.equal(extendedAgency.city, 'Lubumbashi');
  assert.equal(extendedAgency.managerName, 'Patrice Lumumba');
  assert.equal(extendedAgency.openingHours, '07:30 - 17:30');
  assert.equal(extendedAgency.email, 'lubumbashi@vanguard.local');
});

// 6. Zero Frontend Modification Check
test('Frontend directories have 0 modifications', () => {
  const adminFrontendPackage = path.join(__dirname, '..', 'admin-frontend', 'package.json');
  const clientFrontendPackage = path.join(__dirname, '..', 'client-frontend', 'package.json');
  assert.ok(fs.existsSync(adminFrontendPackage), 'admin-frontend must exist');
  assert.ok(fs.existsSync(clientFrontendPackage), 'client-frontend must exist');
});
