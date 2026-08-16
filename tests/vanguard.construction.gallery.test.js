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

test('project gallery CRUD and primary', async () => {
  // create project as construction user
  const departments = await request('GET', '/api/departments', null, adminToken);
  const constructionDept = departments.data.data.items.find((d) => d.type === 'CONSTRUCTION');
  assert.ok(constructionDept);

  const projectRes = await request('POST', '/api/construction/projects', {
    title: `Gallery Test Project ${Date.now()}`,
    departmentId: constructionDept.id,
    description: 'Project for gallery tests',
    budget: 1000,
  }, constructionToken);
  assert.equal(projectRes.status, 201);
  const project = projectRes.data.data.project;

  // create two media entries via Media table directly
  const media1 = await (async () => {
    const res = await fetch(`${baseUrl}/api/admin/media`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ fileName: 'a.jpg', originalName: 'a.jpg', mimeType: 'image/jpeg', size: 123, url: '/media/a.jpg', entityType: 'PROJECT', entityId: project.id }) });
    const data = await res.json();
    return data.data.media;
  })();

  const media2 = await (async () => {
    const res = await fetch(`${baseUrl}/api/admin/media`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ fileName: 'b.jpg', originalName: 'b.jpg', mimeType: 'image/jpeg', size: 456, url: '/media/b.jpg', entityType: 'PROJECT', entityId: project.id }) });
    const data = await res.json();
    return data.data.media;
  })();

  // add media to gallery
  const add1 = await request('POST', `/api/construction/projects/${project.id}/gallery`, { mediaId: media1.id, caption: 'First', order: 0 }, constructionToken);
  assert.equal(add1.status, 201);
  const g1 = add1.data.data.gallery;
  assert.equal(g1.media.id, media1.id);

  const add2 = await request('POST', `/api/construction/projects/${project.id}/gallery`, { mediaId: media2.id, caption: 'Second', order: 1 }, constructionToken);
  assert.equal(add2.status, 201);
  const g2 = add2.data.data.gallery;
  assert.equal(g2.media.id, media2.id);

  // list gallery
  const listRes = await request('GET', `/api/construction/projects/${project.id}/gallery`, null, constructionToken);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.data.data.items.length, 2);

  // set primary (g2)
  const setPrimaryRes = await request('POST', `/api/construction/projects/${project.id}/gallery/${g2.id}/set-primary`, null, constructionToken);
  assert.equal(setPrimaryRes.status, 200);

  const listAfter = await request('GET', `/api/construction/projects/${project.id}/gallery`, null, constructionToken);
  assert.equal(listAfter.status, 200);
  const items = listAfter.data.data.items;
  // primary should have order 0
  const primary = items.find((i) => i.id === g2.id);
  assert.equal(primary.order, 0);

  // update caption
  const updateRes = await request('PUT', `/api/construction/projects/${project.id}/gallery/${g1.id}`, { caption: 'Updated' }, constructionToken);
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.data.data.gallery.caption, 'Updated');

  // delete
  const deleteRes = await request('DELETE', `/api/construction/projects/${project.id}/gallery/${g1.id}`, null, constructionToken);
  assert.equal(deleteRes.status, 200);

  // security checks: other dept user should be forbidden
  // create a user in different dept
});
