const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/app');
const { main: seedMain } = require('../prisma/seed');

let server;
let baseUrl;
let adminToken;
let adminUserId;

const request = async (method, path, body, token) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof Buffer)) headers['Content-Type'] = 'application/json';

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
  adminUserId = loginRes.data.data.user.id;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('vehicle inquiry flows and audit coverage for auto sales', async () => {
  const departmentsRes = await request('GET', '/api/departments', null, adminToken);
  assert.equal(departmentsRes.status, 200);
  const autoSales = departmentsRes.data.data.items.find((item) => item.type === 'AUTO_SALES');
  assert.ok(autoSales, 'AUTO_SALES department must exist');

  const createVehicleRes = await request('POST', '/api/vehicles', {
    departmentId: autoSales.id,
    brand: 'Ford',
    model: 'Mustang',
    year: 2021,
    mileage: 8000,
    fuelType: 'Gasoline',
    transmission: 'Manual',
    price: '45000.00',
    description: 'Inquiry test vehicle',
  }, adminToken);

  assert.equal(createVehicleRes.status, 201);
  const vehicleId = createVehicleRes.data.data.vehicle.id;
  assert.ok(vehicleId, 'Created vehicle should have an id');

  const createInquiryRes = await request('POST', '/api/vehicle-inquiries', {
    vehicleId,
    customerName: 'Pierre Dupont',
    customerPhone: '+33123456789',
    customerEmail: 'pierre.dupont@example.com',
    inquiryType: 'PRICE_REQUEST',
    contactPreference: 'EMAIL',
    message: 'Je souhaite connaître le prix final avec livraison.',
  }, adminToken);

  assert.equal(createInquiryRes.status, 201);
  const inquiry = createInquiryRes.data.data.vehicleInquiry;
  assert.equal(inquiry.status, 'NEW');
  assert.equal(inquiry.vehicle.id, vehicleId);
  assert.equal(inquiry.createdBy.id, adminUserId);
  assert.equal(inquiry.customerEmail, 'pierre.dupont@example.com');

  const getInquiryRes = await request('GET', `/api/vehicle-inquiries/${inquiry.id}`, null, adminToken);
  assert.equal(getInquiryRes.status, 200);
  assert.equal(getInquiryRes.data.data.vehicleInquiry.id, inquiry.id);

  const listInquiryRes = await request('GET', `/api/vehicle-inquiries?vehicleId=${vehicleId}`, null, adminToken);
  assert.equal(listInquiryRes.status, 200);
  assert.ok(Array.isArray(listInquiryRes.data.data.items));
  assert.ok(listInquiryRes.data.data.items.some((item) => item.id === inquiry.id));

  const updateInquiryRes = await request('PUT', `/api/vehicle-inquiries/${inquiry.id}`, {
    status: 'CONTACTED',
    assignedToUserId: adminUserId,
    internalNotes: 'Premier contact effectué.',
  }, adminToken);

  assert.equal(updateInquiryRes.status, 200);
  assert.equal(updateInquiryRes.data.data.vehicleInquiry.status, 'CONTACTED');
  assert.equal(updateInquiryRes.data.data.vehicleInquiry.assignedTo.id, adminUserId);
  assert.equal(updateInquiryRes.data.data.vehicleInquiry.internalNotes, 'Premier contact effectué.');

  const auditRes = await request('GET', '/api/audit-logs', null, adminToken);
  assert.equal(auditRes.status, 200);
  assert.ok(auditRes.data.data.items.some((item) => item.action === 'create_vehicle_inquiry'));
  assert.ok(auditRes.data.data.items.some((item) => item.action === 'vehicle_inquiry_status_change'));
  assert.ok(auditRes.data.data.items.some((item) => item.action === 'assign_vehicle_inquiry'));
});

test('vehicle inquiry validation rejects bad input', async () => {
  const departmentsRes = await request('GET', '/api/departments', null, adminToken);
  assert.equal(departmentsRes.status, 200);
  const autoSales = departmentsRes.data.data.items.find((item) => item.type === 'AUTO_SALES');
  assert.ok(autoSales, 'AUTO_SALES department must exist');

  const createVehicleRes = await request('POST', '/api/vehicles', {
    departmentId: autoSales.id,
    brand: 'Peugeot',
    model: '208',
    year: 2020,
    mileage: 4000,
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    price: '17000.00',
    description: 'Validation test vehicle',
  }, adminToken);

  assert.equal(createVehicleRes.status, 201);
  const vehicleId = createVehicleRes.data.data.vehicle.id;
  assert.ok(vehicleId);

  const invalidEmailRes = await request('POST', '/api/vehicle-inquiries', {
    vehicleId,
    customerName: 'Marie',
    customerPhone: '+33123456789',
    customerEmail: 'invalid-email',
    message: 'Demande de renseignement valide.',
  }, adminToken);
  assert.equal(invalidEmailRes.status, 400);

  const createInquiryRes = await request('POST', '/api/vehicle-inquiries', {
    vehicleId,
    customerName: 'Marie',
    customerPhone: '+33123456789',
    customerEmail: 'marie@example.com',
    message: 'Demande de renseignement valide.',
  }, adminToken);
  assert.equal(createInquiryRes.status, 201);
  const inquiryId = createInquiryRes.data.data.vehicleInquiry.id;

  const invalidStatusRes = await request('PUT', `/api/vehicle-inquiries/${inquiryId}`, {
    status: 'INVALID_STATUS',
  }, adminToken);
  assert.equal(invalidStatusRes.status, 400);

  const invalidContactPrefRes = await request('PUT', `/api/vehicle-inquiries/${inquiryId}`, {
    contactPreference: 'PIGEON',
  }, adminToken);
  assert.equal(invalidContactPrefRes.status, 400);
});

test('vehicle inquiry endpoints enforce permission boundaries for auto sales staff', async () => {
  const departmentsRes = await request('GET', '/api/departments', null, adminToken);
  assert.equal(departmentsRes.status, 200);
  const autoSales = departmentsRes.data.data.items.find((item) => item.type === 'AUTO_SALES');
  assert.ok(autoSales, 'AUTO_SALES department must exist');

  const rolesRes = await request('GET', '/api/roles', null, adminToken);
  assert.equal(rolesRes.status, 200);
  const autoServiceAdminRole = rolesRes.data.data.items.find((item) => item.name === 'SERVICE_ADMIN');
  assert.ok(autoServiceAdminRole, 'SERVICE_ADMIN role must exist');

  const createUserRes = await request('POST', '/api/users', {
    firstName: 'Auto',
    lastName: 'Sales',
    email: `auto.sales.${Date.now()}@example.com`,
    phone: '+33123456790',
    roleId: autoServiceAdminRole.id,
    departmentId: autoSales.id,
  }, adminToken);

  assert.equal(createUserRes.status, 201);
  const tempPassword = createUserRes.data.data.user.temporaryPassword;
  assert.ok(tempPassword, 'Temporary password should be returned');

  const loginRes = await request('POST', '/api/auth/login', {
    identifier: createUserRes.data.data.user.email,
    password: tempPassword,
  });
  assert.equal(loginRes.status, 200);
  const userToken = loginRes.data.data.token;

  const createVehicleRes = await request('POST', '/api/vehicles', {
    departmentId: autoSales.id,
    brand: 'Renault',
    model: 'Clio',
    year: 2020,
    mileage: 9000,
    fuelType: 'Gasoline',
    transmission: 'Manual',
    price: '15000.00',
    description: 'Permission test vehicle',
  }, adminToken);

  assert.equal(createVehicleRes.status, 201);
  const vehicleId = createVehicleRes.data.data.vehicle.id;

  const deniedCreateRes = await request('POST', '/api/vehicle-inquiries', {
    vehicleId,
    customerName: 'Client',
    customerPhone: '+33123456791',
    customerEmail: 'client@example.com',
    message: 'Je souhaite réserver.',
  }, userToken);

  assert.equal(deniedCreateRes.status, 403);

  const deniedListRes = await request('GET', `/api/vehicle-inquiries?vehicleId=${vehicleId}`, null, userToken);
  assert.equal(deniedListRes.status, 403);
});
