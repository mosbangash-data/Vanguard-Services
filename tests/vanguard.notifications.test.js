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

  const loginRes = await request('POST', '/api/auth/login', { identifier: 'admin@vanguard.local', password: 'Admin123!' });
  assert.equal(loginRes.status, 200);
  adminToken = loginRes.data.data.token;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('notifications create, list and mark read', async () => {
  const create = await request('POST', '/api/notifications', { title: 'Hello', message: 'World' }, adminToken);
  assert.equal(create.status, 201);
  const notif = create.data.data.notification;

  const list = await request('GET', '/api/notifications', null, adminToken);
  assert.equal(list.status, 200);
  const items = list.data.data.items;
  assert.ok(items.length >= 1);

  const mark = await request('PUT', `/api/notifications/${notif.id}/read`, null, adminToken);
  assert.equal(mark.status, 200);
  assert.equal(mark.data.data.notification.isRead, true);
});
