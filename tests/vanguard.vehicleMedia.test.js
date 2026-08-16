const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/app');
const { main: seedMain } = require('../prisma/seed');

let server;
let baseUrl;
let adminToken;
let vehicleId;
let mediaId;

const request = async (method, path, body, token) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';

  const options = { method, headers };
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
};

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
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('vehicle media CRUD flows for auto sales', async () => {
  const departments = await request('GET', '/api/departments', null, adminToken);
  assert.equal(departments.status, 200);
  const autoSales = departments.data.data.items.find((item) => item.type === 'AUTO_SALES');
  assert.ok(autoSales, 'AUTO_SALES department must exist');

  const createVehicle = await request('POST', '/api/vehicles', {
    departmentId: autoSales.id,
    brand: 'Nissan',
    model: 'Altima',
    year: 2022,
    mileage: 5000,
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    price: '27000.00',
    description: 'Media test vehicle',
  }, adminToken);

  assert.equal(createVehicle.status, 201);
  vehicleId = createVehicle.data.data.vehicle.id;
  assert.ok(vehicleId, 'Created vehicle should have an id');

  const createMedia = await request('POST', '/api/vehicle-media', {
    vehicleId,
    caption: 'Front exterior',
    order: 1,
    isPrimary: true,
    fileName: 'front.jpg',
    originalName: 'front.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    url: 'https://example.com/front.jpg',
  }, adminToken);

  assert.equal(createMedia.status, 201);
  mediaId = createMedia.data.data.vehicleMedia.id;
  assert.ok(mediaId, 'Created vehicle media should have an id');
  assert.equal(createMedia.data.data.vehicleMedia.isPrimary, true);

  const listResponse = await request('GET', `/api/vehicle-media/vehicle/${vehicleId}`, null, adminToken);
  assert.equal(listResponse.status, 200);
  assert.ok(Array.isArray(listResponse.data.data.items));
  assert.equal(listResponse.data.data.items.length, 1);
  assert.equal(listResponse.data.data.items[0].id, mediaId);

  const getResponse = await request('GET', `/api/vehicle-media/${mediaId}`, null, adminToken);
  assert.equal(getResponse.status, 200);
  assert.equal(getResponse.data.data.vehicleMedia.id, mediaId);

  const updateResponse = await request('PUT', `/api/vehicle-media/${mediaId}`, {
    caption: 'Front exterior updated',
    isPrimary: false,
  }, adminToken);

  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.data.data.vehicleMedia.caption, 'Front exterior updated');
  assert.equal(updateResponse.data.data.vehicleMedia.isPrimary, false);

  const createSecondMedia = await request('POST', '/api/vehicle-media', {
    vehicleId,
    caption: 'Side view',
    order: 2,
    isPrimary: true,
    fileName: 'side.jpg',
    originalName: 'side.jpg',
    mimeType: 'image/jpeg',
    size: 2048,
    url: 'https://example.com/side.jpg',
  }, adminToken);

  assert.equal(createSecondMedia.status, 201);
  const secondMediaId = createSecondMedia.data.data.vehicleMedia.id;
  assert.ok(secondMediaId);
  assert.equal(createSecondMedia.data.data.vehicleMedia.isPrimary, true);

  const listAfterPrimary = await request('GET', `/api/vehicle-media/vehicle/${vehicleId}`, null, adminToken);
  assert.equal(listAfterPrimary.status, 200);
  const primaryItems = listAfterPrimary.data.data.items.filter((item) => item.isPrimary);
  assert.equal(primaryItems.length, 1);
  assert.equal(primaryItems[0].id, secondMediaId);

  const deleteFirst = await request('DELETE', `/api/vehicle-media/${mediaId}`, null, adminToken);
  assert.equal(deleteFirst.status, 200);

  const deleteSecond = await request('DELETE', `/api/vehicle-media/${secondMediaId}`, null, adminToken);
  assert.equal(deleteSecond.status, 200);
});
