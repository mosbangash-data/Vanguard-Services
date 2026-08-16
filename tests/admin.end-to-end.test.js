const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const { main: seedMain } = require('../prisma/seed');

let server;
let baseUrl;
let adminToken;

async function request(method, path, body, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof Buffer)) {
    headers['Content-Type'] = 'application/json';
  }

  const options = {
    method,
    headers,
  };

  if (body !== undefined && body !== null) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { status: res.status, data };
}

test.before(async () => {
  await seedMain();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  const loginRes = await request('POST', '/api/auth/login', {
    identifier: 'admin@vanguard.local',
    password: 'Admin123!',
  });

  assert.equal(loginRes.status, 200);
  adminToken = loginRes.data.data.token;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('admin users CRUD and audit endpoints', async () => {
  const listUsers = await request('GET', '/api/users', null, adminToken);
  assert.equal(listUsers.status, 200);
  assert.ok(listUsers.data.success);

  const createUser = await request('POST', '/api/users', {
    firstName: 'QA',
    lastName: 'User',
    email: `qa.${Date.now()}@vanguard.local`,
    roleId: listUsers.data.data.items[0].roleId,
    departmentId: listUsers.data.data.items[0].departmentId,
  }, adminToken);
  assert.equal(createUser.status, 201);
  const userId = createUser.data.data.user.id;

  const getUser = await request('GET', `/api/users/${userId}`, null, adminToken);
  assert.equal(getUser.status, 200);

  const updateUser = await request('PUT', `/api/users/${userId}`, {
    firstName: 'QA2',
    lastName: 'User2',
    phone: '+33000000001',
  }, adminToken);
  assert.equal(updateUser.status, 200);

  const statusUser = await request('PATCH', `/api/users/${userId}/status`, { status: 'INACTIVE' }, adminToken);
  assert.equal(statusUser.status, 200);

  const resetPassword = await request('PATCH', `/api/users/${userId}/password-reset`, null, adminToken);
  assert.equal(resetPassword.status, 200);

  const auditLogs = await request('GET', '/api/admin/audit-logs', null, adminToken);
  assert.equal(auditLogs.status, 200);
  assert.ok(Array.isArray(auditLogs.data.data.items));
});

test('admin roles CRUD', async () => {
  const createRole = await request('POST', '/api/roles', {
    name: `QA_ROLE_${Date.now()}`,
    description: 'Temporary QA role',
  }, adminToken);
  assert.equal(createRole.status, 201);
  const roleId = createRole.data.data.role.id;

  const listRoles = await request('GET', '/api/roles', null, adminToken);
  assert.equal(listRoles.status, 200);

  const getRole = await request('GET', `/api/roles/${roleId}`, null, adminToken);
  assert.equal(getRole.status, 200);

  const updateRole = await request('PUT', `/api/roles/${roleId}`, {
    name: `QA_ROLE_${Date.now()}_UPDATED`,
    description: 'Updated QA role',
  }, adminToken);
  assert.equal(updateRole.status, 200);

  const deleteRole = await request('DELETE', `/api/roles/${roleId}`, null, adminToken);
  assert.equal(deleteRole.status, 200);
});

test('admin permissions CRUD', async () => {
  const createPermission = await request('POST', '/api/permissions', {
    name: `QA_PERMISSION_${Date.now()}`,
    description: 'Temporary QA permission',
  }, adminToken);
  assert.equal(createPermission.status, 201);
  const permissionId = createPermission.data.data.permission.id;

  const listPermissions = await request('GET', '/api/permissions', null, adminToken);
  assert.equal(listPermissions.status, 200);

  const getPermission = await request('GET', `/api/permissions/${permissionId}`, null, adminToken);
  assert.equal(getPermission.status, 200);

  const updatePermission = await request('PUT', `/api/permissions/${permissionId}`, {
    name: `QA_PERMISSION_${Date.now()}_UPDATED`,
    description: 'Updated QA permission',
  }, adminToken);
  assert.equal(updatePermission.status, 200);

  const deletePermission = await request('DELETE', `/api/permissions/${permissionId}`, null, adminToken);
  assert.equal(deletePermission.status, 200);
});

test('admin departments CRUD', async () => {
  const listDepartments = await request('GET', '/api/departments', null, adminToken);
  assert.equal(listDepartments.status, 200);

  const listUsers = await request('GET', '/api/users?limit=100', null, adminToken);
  assert.equal(listUsers.status, 200);

  const usedDepartmentIds = new Set((listUsers.data.data.items || []).map((user) => user.departmentId));
  const deletableDepartment = listDepartments.data.data.items.find((department) => !usedDepartmentIds.has(department.id));
  assert.ok(deletableDepartment, 'No deletable department was available for cleanup');

  const deleteDepartment = await request('DELETE', `/api/departments/${deletableDepartment.id}`, null, adminToken);
  assert.equal(deleteDepartment.status, 200);

  const createDepartment = await request('POST', '/api/departments', {
    type: deletableDepartment.type,
    name: `${deletableDepartment.name} QA`,
    description: 'Temporary QA department',
    isActive: true,
  }, adminToken);
  assert.equal(createDepartment.status, 201);

  const departmentId = createDepartment.data.data.department.id;
  const getDepartment = await request('GET', `/api/departments/${departmentId}`, null, adminToken);
  assert.equal(getDepartment.status, 200);

  const updateDepartment = await request('PUT', `/api/departments/${departmentId}`, {
    name: `${deletableDepartment.name} QA Updated`,
    description: 'Updated QA department',
    isActive: true,
  }, adminToken);
  assert.equal(updateDepartment.status, 200);

  const deleteDepartmentAgain = await request('DELETE', `/api/departments/${departmentId}`, null, adminToken);
  assert.equal(deleteDepartmentAgain.status, 200);
});
