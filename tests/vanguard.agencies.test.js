const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/app');
const { main: seedMain } = require('../prisma/seed');

let server;
let baseUrl;
let adminToken;

async function request(method, path, body, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof Buffer)) headers['Content-Type'] = 'application/json';

  const options = { method, headers };
  if (body !== undefined && body !== null) options.body = typeof body === 'string' ? body : JSON.stringify(body);

  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
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

test('vanguard agencies CRUD', async () => {
  const deps = await request('GET', '/api/departments', null, adminToken);
  assert.equal(deps.status, 200);
  const department = deps.data.data.items.find((item) => item.type === 'VANGUARD_COACH') || deps.data.data.items[0];

  const create = await request('POST', '/api/agencies', {
    name: `QA Agency ${Date.now()}`,
    code: `QA_${Date.now()}`,
    departmentId: department.id,
    address: '123 Test St',
    phone: '+1234567890'
  }, adminToken);
  assert.equal(create.status, 201);
  const agencyId = create.data.data.agency.id;

  const getOne = await request('GET', `/api/agencies/${agencyId}`, null, adminToken);
  assert.equal(getOne.status, 200);

  const list = await request('GET', '/api/agencies', null, adminToken);
  assert.equal(list.status, 200);

  const update = await request('PUT', `/api/agencies/${agencyId}`, { name: 'QA Updated' }, adminToken);
  assert.equal(update.status, 200);

  const del = await request('DELETE', `/api/agencies/${agencyId}`, null, adminToken);
  assert.equal(del.status, 200);
});
