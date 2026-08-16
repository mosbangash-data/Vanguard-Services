const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const { main: seedMain } = require('../prisma/seed');

let server;
let baseUrl;
let engineerA;
let engineerB;
let adminToken;
let constructionToken;
let projectA;
let projectB;

async function request(method, path, body, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined || body === null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

async function login(identifier, password) {
  const response = await request('POST', '/api/auth/login', { identifier, password });
  assert.equal(response.status, 200, `${identifier} should authenticate`);
  return response.data.data;
}

test.before(async () => {
  await seedMain();
  server = http.createServer(app);
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve()));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  engineerA = await login('engineer.a@vanguard.local', 'EngineerA123!');
  engineerB = await login('engineer.b@vanguard.local', 'EngineerB123!');
  adminToken = (await login('admin@vanguard.local', 'Admin123!')).token;
  constructionToken = (await login('construction@vanguard.local', 'Construction123!')).token;

  const aProjects = await request('GET', '/api/construction/engineer/projects', null, engineerA.token);
  const bProjects = await request('GET', '/api/construction/engineer/projects', null, engineerB.token);
  assert.equal(aProjects.status, 200);
  assert.equal(bProjects.status, 200);
  projectA = aProjects.data.data.items[0];
  projectB = bProjects.data.data.items[0];
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('engineers only receive and access their assigned projects', async () => {
  assert.equal(engineerA.user.role, 'ENGINEER');
  assert.equal(engineerA.user.permissions.includes('VIEW_CUSTOMER_REQUEST'), false);
  assert.equal(engineerA.user.permissions.includes('UPDATE_CUSTOMER_REQUEST'), false);
  assert.equal(engineerA.user.permissions.includes('CREATE_CUSTOMER_REQUEST'), false);
  assert.equal(engineerA.user.permissions.includes('VIEW_QUOTE_REQUEST'), false);
  assert.ok(projectA && projectB);
  assert.notEqual(projectA.id, projectB.id);

  const aList = await request('GET', '/api/construction/engineer/projects', null, engineerA.token);
  const bList = await request('GET', '/api/construction/engineer/projects', null, engineerB.token);
  assert.deepEqual(aList.data.data.items.map((item) => item.id), [projectA.id]);
  assert.deepEqual(bList.data.data.items.map((item) => item.id), [projectB.id]);

  // Project GET isolation
  assert.equal((await request('GET', `/api/construction/projects/${projectA.id}`, null, engineerA.token)).status, 200);
  assert.equal((await request('GET', `/api/construction/projects/${projectB.id}`, null, engineerB.token)).status, 200);
  assert.equal((await request('GET', `/api/construction/projects/${projectB.id}`, null, engineerA.token)).status, 403);
  assert.equal((await request('GET', `/api/construction/projects/${projectA.id}`, null, engineerB.token)).status, 403);

  // Project URL manipulation / modification isolation
  const aModifiesOwn = await request('PUT', `/api/construction/projects/${projectA.id}`, { description: 'Description modifiée par Engineer A.' }, engineerA.token);
  assert.equal(aModifiesOwn.status, 200);
  assert.equal(aModifiesOwn.data.data.project.description, 'Description modifiée par Engineer A.');

  const aModifiesB = await request('PUT', `/api/construction/projects/${projectB.id}`, { description: 'Tentative frauduleuse de A sur B.' }, engineerA.token);
  assert.equal(aModifiesB.status, 403);

  const bModifiesA = await request('PUT', `/api/construction/projects/${projectA.id}`, { description: 'Tentative frauduleuse de B sur A.' }, engineerB.token);
  assert.equal(bModifiesA.status, 403);

  // Engineer forbidden from global customer & quote requests
  assert.equal((await request('GET', '/api/construction/customer-requests', null, engineerA.token)).status, 403);
  assert.equal((await request('GET', '/api/construction/quote-requests', null, engineerA.token)).status, 403);
});

test('project updates and galleries enforce the same assignment boundary', async () => {
  const createOwnUpdate = await request('POST', `/api/construction/projects/${projectA.id}/updates`, {
    title: 'Inspection quotidienne', description: 'Inspection du chantier attribué à Engineer A.',
  }, engineerA.token);
  assert.equal(createOwnUpdate.status, 201);
  const updateId = createOwnUpdate.data.data.projectUpdate.id;

  assert.equal((await request('GET', `/api/construction/projects/${projectA.id}/updates`, null, engineerA.token)).status, 200);
  assert.equal((await request('GET', `/api/construction/projects/${projectA.id}/updates`, null, engineerB.token)).status, 403);
  assert.equal((await request('GET', `/api/construction/projects/${projectA.id}/updates/${updateId}`, null, engineerA.token)).status, 200);
  assert.equal((await request('GET', `/api/construction/projects/${projectA.id}/updates/${updateId}`, null, engineerB.token)).status, 403);

  // Update modification isolation
  const editOwnUpdate = await request('PUT', `/api/construction/projects/${projectA.id}/updates/${updateId}`, {
    title: 'Inspection mise à jour', description: 'Description corrigée.',
  }, engineerA.token);
  assert.equal(editOwnUpdate.status, 200);

  const bEditsAUpdate = await request('PUT', `/api/construction/projects/${projectA.id}/updates/${updateId}`, {
    title: 'Piratage par B', description: 'Interdit.',
  }, engineerB.token);
  assert.equal(bEditsAUpdate.status, 403);

  assert.equal((await request('POST', `/api/construction/projects/${projectB.id}/updates`, {
    title: 'Tentative interdite', description: 'Engineer A ne doit pas écrire sur le projet B.',
  }, engineerA.token)).status, 403);

  const media = await request('POST', '/api/admin/media', {
    fileName: 'site-a.jpg', originalName: 'site-a.jpg', mimeType: 'image/jpeg', size: 1,
    url: 'https://example.test/site-a.jpg', entityType: 'PROJECT', entityId: projectA.id,
  }, adminToken);
  assert.equal(media.status, 201);
  const gallery = await request('POST', `/api/construction/projects/${projectA.id}/gallery`, { mediaId: media.data.data.media.id }, constructionToken);
  assert.equal(gallery.status, 201);
  assert.equal((await request('GET', `/api/construction/projects/${projectA.id}/gallery`, null, engineerA.token)).status, 200);
  assert.equal((await request('GET', `/api/construction/projects/${projectA.id}/gallery`, null, engineerB.token)).status, 403);
  assert.equal((await request('GET', `/api/construction/projects/${projectA.id}/gallery/${gallery.data.data.gallery.id}`, null, engineerB.token)).status, 403);
});

test('construction engineer endpoints reject unauthenticated requests', async () => {
  assert.equal((await request('GET', '/api/construction/engineer/projects')).status, 401);
  assert.equal((await request('GET', '/api/construction/engineer/projects', null, 'invalid')).status, 401);
});

test('non-existent project returns 404 safely', async () => {
  assert.equal((await request('GET', '/api/construction/projects/non-existent-id-12345', null, engineerA.token)).status, 404);
});

