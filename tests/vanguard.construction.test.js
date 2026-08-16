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
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve())));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  const loginRes = await request('POST', '/api/auth/login', {
    identifier: 'admin@vanguard.local',
    password: 'Admin123!',
  });

  assert.equal(loginRes.status, 200, 'Admin login should succeed');
  adminToken = loginRes.data.data.token;

  const constructionLoginRes = await request('POST', '/api/auth/login', {
    identifier: 'construction@vanguard.local',
    password: 'Construction123!',
  });

  assert.equal(constructionLoginRes.status, 200, 'Construction user login should succeed');
  constructionToken = constructionLoginRes.data.data.token;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('seeded construction role has correct permissions', async () => {
  const rolesRes = await request('GET', '/api/roles', null, adminToken);
  assert.equal(rolesRes.status, 200);
  const constructionRole = rolesRes.data.data.items.find((item) => item.name === 'CONSTRUCTION');
  assert.ok(constructionRole, 'CONSTRUCTION role should be seeded');
  assert.ok(constructionRole.permissions.includes('CREATE_CUSTOMER_REQUEST'));
  assert.ok(constructionRole.permissions.includes('VIEW_PROJECT'));
  assert.ok(constructionRole.permissions.includes('DELETE_PROJECT'));
});

test('construction customer requests and quote requests and projects', async () => {
  const createRequestRes = await request('POST', '/api/construction/customer-requests', {
    subject: 'New construction inquiry',
    customerName: 'Alice Doe',
    customerPhone: '+1234567890',
    message: 'I need a quote for a residential building project.',
  }, constructionToken);

  assert.equal(createRequestRes.status, 201);
  const customerRequest = createRequestRes.data.data.customerRequest;
  assert.equal(customerRequest.subject, 'New construction inquiry');

  const getRequestRes = await request('GET', `/api/construction/customer-requests/${customerRequest.id}`, null, constructionToken);
  assert.equal(getRequestRes.status, 200);
  assert.equal(getRequestRes.data.data.customerRequest.id, customerRequest.id);

  const updateRequestRes = await request('PUT', `/api/construction/customer-requests/${customerRequest.id}`, {
    status: 'IN_PROGRESS',
  }, constructionToken);
  assert.equal(updateRequestRes.status, 200);
  assert.equal(updateRequestRes.data.data.customerRequest.status, 'IN_PROGRESS');

  const createQuoteRes = await request('POST', '/api/construction/quote-requests', {
    customerName: 'Bob Builder',
    customerPhone: '+0987654321',
    description: 'Need a quote for a small renovation project.',
  }, constructionToken);

  assert.equal(createQuoteRes.status, 201);
  const quoteRequest = createQuoteRes.data.data.quoteRequest;
  assert.equal(quoteRequest.customerName, 'Bob Builder');

  const getQuoteRes = await request('GET', `/api/construction/quote-requests/${quoteRequest.id}`, null, constructionToken);
  assert.equal(getQuoteRes.status, 200);
  assert.equal(getQuoteRes.data.data.quoteRequest.id, quoteRequest.id);

  const projectTitle = `Test Project ${Date.now()}`;
  const createProjectRes = await request('POST', '/api/construction/projects', {
    title: projectTitle,
    departmentId: (await request('GET', '/api/departments', null, adminToken)).data.data.items.find((item) => item.type === 'CONSTRUCTION').id,
    location: 'Test City',
    description: 'A test construction project.',
    budget: 50000,
  }, constructionToken);

  assert.equal(createProjectRes.status, 201);
  const project = createProjectRes.data.data.project;
  assert.equal(project.title, projectTitle);

  const getProjectRes = await request('GET', `/api/construction/projects/${project.id}`, null, constructionToken);
  assert.equal(getProjectRes.status, 200);
  assert.equal(getProjectRes.data.data.project.id, project.id);

  const updateProjectRes = await request('PUT', `/api/construction/projects/${project.id}`, {
    status: 'PUBLISHED',
  }, constructionToken);

  assert.equal(updateProjectRes.status, 200);
  assert.equal(updateProjectRes.data.data.project.status, 'PUBLISHED');
});
