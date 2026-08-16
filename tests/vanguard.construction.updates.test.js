const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/app');
const { main: seedMain } = require('../prisma/seed');

let server;
let baseUrl;
let adminToken;
let constructionToken;

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
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve())));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  const loginRes = await request('POST', '/api/auth/login', {
    identifier: 'admin@vanguard.local',
    password: 'Admin123!',
  });
  assert.equal(loginRes.status, 200);
  adminToken = loginRes.data.data.token;

  const constructionLoginRes = await request('POST', '/api/auth/login', {
    identifier: 'construction@vanguard.local',
    password: 'Construction123!',
  });
  assert.equal(constructionLoginRes.status, 200);
  constructionToken = constructionLoginRes.data.data.token;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('project updates CRUD', async () => {
  // create project as construction user
  const departments = await request('GET', '/api/departments', null, adminToken);
  const constructionDept = departments.data.data.items.find((d) => d.type === 'CONSTRUCTION');
  assert.ok(constructionDept);

  const projectRes = await request('POST', '/api/construction/projects', {
    title: `Update Test Project ${Date.now()}`,
    departmentId: constructionDept.id,
    description: 'Project for update tests',
    budget: 1000,
  }, constructionToken);
  assert.equal(projectRes.status, 201);
  const project = projectRes.data.data.project;

  // create update
  const createUpdateRes = await request('POST', `/api/construction/projects/${project.id}/updates`, {
    title: 'Phase 1 completed',
    description: 'We finished foundation works.',
  }, constructionToken);
  assert.equal(createUpdateRes.status, 201);
  const update = createUpdateRes.data.data.projectUpdate;
  assert.equal(update.title, 'Phase 1 completed');

  // get update
  const getUpdateRes = await request('GET', `/api/construction/projects/${project.id}/updates/${update.id}`, null, constructionToken);
  assert.equal(getUpdateRes.status, 200);
  assert.equal(getUpdateRes.data.data.projectUpdate.id, update.id);

  // update update
  const updateRes = await request('PUT', `/api/construction/projects/${project.id}/updates/${update.id}`, {
    title: 'Phase 1 - foundation',
  }, constructionToken);
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.data.data.projectUpdate.title, 'Phase 1 - foundation');

  // delete update
  const deleteRes = await request('DELETE', `/api/construction/projects/${project.id}/updates/${update.id}`, null, constructionToken);
  assert.equal(deleteRes.status, 200);
});
