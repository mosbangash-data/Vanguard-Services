const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/app');
const { main: seedMain } = require('../prisma/seed');

let server;
let baseUrl;
let adminToken;
let adminUserId;
let autoSalesAdminToken;
let coachAdminToken;

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
    try { data = JSON.parse(text); } catch { data = text; }
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

  const autoSalesLogin = await request('POST', '/api/auth/login', {
    identifier: 'autosales.admin@vanguard.local',
    password: process.env.AUTOSALES_ADMIN_PASSWORD || 'dev-autosales-admin-password',
  });
  assert.equal(autoSalesLogin.status, 200, 'AutoSales SERVICE_ADMIN login should succeed');
  autoSalesAdminToken = autoSalesLogin.data.data.token;

  const coachLogin = await request('POST', '/api/auth/login', {
    identifier: 'coach.admin@vanguard.local',
    password: process.env.COACH_ADMIN_PASSWORD || 'dev-coach-admin-password',
  });
  assert.equal(coachLogin.status, 200, 'Coach SERVICE_ADMIN login should succeed');
  coachAdminToken = coachLogin.data.data.token;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('auto sales commercial workflow: inquiry reservation payment and final sale', async () => {
  const superDashboard = await request('GET', '/api/dashboard/autosales', null, adminToken);
  assert.equal(superDashboard.status, 200);
  assert.equal(superDashboard.data.data.scope.department, 'AUTO_SALES');
  const serviceDashboard = await request('GET', '/api/dashboard/autosales', null, autoSalesAdminToken);
  assert.equal(serviceDashboard.status, 200);
  assert.equal(serviceDashboard.data.data.scope.department, 'AUTO_SALES');
  const coachDashboard = await request('GET', '/api/dashboard/autosales', null, coachAdminToken);
  assert.equal(coachDashboard.status, 403, 'Other departments must not read AutoSales dashboard data');
  const departmentsRes = await request('GET', '/api/departments', null, adminToken);
  assert.equal(departmentsRes.status, 200);
  const autoSalesDept = departmentsRes.data.data.items.find((item) => item.type === 'AUTO_SALES');
  assert.ok(autoSalesDept, 'AUTO_SALES department must exist');

  const vehicleCreateRes = await request('POST', '/api/vehicles', {
    departmentId: autoSalesDept.id,
    brand: 'Ford',
    model: 'Mustang Workflow',
    year: 2024,
    mileage: 1500,
    fuelType: 'Gasoline',
    transmission: 'Manual',
    price: '52000.00',
    description: 'Workflow validation vehicle',
  }, adminToken);
  assert.equal(vehicleCreateRes.status, 201, 'Vehicle creation must succeed');
  const vehicleId = vehicleCreateRes.data.data.vehicle.id;

  const inquiryCreateRes = await request('POST', '/api/vehicle-inquiries', {
    vehicleId,
    customerName: 'Workflow Client',
    customerPhone: '+33111111111',
    customerEmail: 'workflow.client@example.com',
    inquiryType: 'PRICE_REQUEST',
    contactPreference: 'EMAIL',
    message: 'Je souhaite réserver cette voiture et finaliser l’achat.',
  }, adminToken);
  assert.equal(inquiryCreateRes.status, 201, 'Inquiry should be creatable');
  const inquiryId = inquiryCreateRes.data.data.vehicleInquiry.id;

  const rolesRes = await request('GET', '/api/roles', null, adminToken);
  assert.equal(rolesRes.status, 200);
  const salesAgentRole = rolesRes.data.data.items.find((item) => item.name === 'AGENT');
  assert.ok(salesAgentRole, 'AGENT role must exist');

  const salesAgentRes = await request('POST', '/api/users', {
    firstName: 'Sales',
    lastName: 'Agent',
    email: `workflow.${Date.now()}@example.com`,
    phone: '+33123456789',
    roleId: salesAgentRole.id,
    departmentId: autoSalesDept.id,
  }, adminToken);
  assert.equal(salesAgentRes.status, 201, 'Auto service admin user should be creatable');
  const salesAgent = salesAgentRes.data.data.user;
  const tempPassword = salesAgentRes.data.data.temporaryPassword;
  assert.ok(tempPassword, 'Temporary password should be issued');

  const salesAgentLogin = await request('POST', '/api/auth/login', {
    identifier: salesAgent.email,
    password: tempPassword,
  });
  assert.equal(salesAgentLogin.status, 200, 'Agent login should succeed');
  const salesAgentToken = salesAgentLogin.data.data.token;

  assert.ok(salesAgentLogin.data.data.user.permissions.includes('VIEW_VEHICLE'));
  assert.ok(salesAgentLogin.data.data.user.permissions.includes('MANAGE_VEHICLE_RESERVATION'));
  assert.ok(!salesAgentLogin.data.data.user.permissions.includes('VIEW_TRIP'));
  assert.ok(!salesAgentLogin.data.data.user.permissions.includes('CREATE_PARCEL'));

  const assignRes = await request('PUT', `/api/vehicle-inquiries/${inquiryId}`, {
    assignedToUserId: salesAgent.id,
    status: 'CONTACTED',
    internalNotes: 'Premier contact et suivi concentré.',
  }, adminToken);
  assert.equal(assignRes.status, 200, 'Assigned agent should be able to update the inquiry');
  assert.equal(assignRes.data.data.vehicleInquiry.assignedTo.id, salesAgent.id);

  const inProgressRes = await request('PUT', `/api/vehicle-inquiries/${inquiryId}`, {
    status: 'IN_PROGRESS',
  }, salesAgentToken);
  assert.equal(inProgressRes.status, 200, 'Inquiry should progress to IN_PROGRESS');
  assert.equal(inProgressRes.data.data.vehicleInquiry.status, 'IN_PROGRESS');
  const agentDashboard = await request('GET', '/api/dashboard/autosales', null, salesAgentToken);
  assert.equal(agentDashboard.status, 200);
  assert.equal(agentDashboard.data.data.scope.agentId, salesAgent.id);
  assert.ok(agentDashboard.data.data.inquiries.recent.some((item) => item.id === inquiryId));

  const reservationDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const expirationDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const reservationRes = await request('POST', '/api/vehicle-reservations', {
    vehicleId,
    customerName: 'Workflow Client',
    customerPhone: '+33111111111',
    customerEmail: 'workflow.client@example.com',
    reservationAmount: '52000.00',
    depositAmount: '1000.00',
    reservationDate,
    expirationDate,
  }, salesAgentToken);
  assert.equal(reservationRes.status, 201, 'Reservation should be created');
  const reservationId = reservationRes.data.data.vehicleReservation.id;

  const vehicleAfterReservation = await request('GET', `/api/vehicles/${vehicleId}`, null, adminToken);
  assert.equal(vehicleAfterReservation.status, 200, 'Vehicle should be readable after reservation');
  assert.equal(vehicleAfterReservation.data.data.vehicle.status, 'RESERVED');

  const paymentRes = await request('POST', '/api/vehicle-payments', {
    reservationId,
    amount: '52000.00',
    method: 'CASH',
    reference: 'WF-PAY-01',
  }, adminToken);
  assert.equal(paymentRes.status, 201, 'Payment should be created');
  const paymentId = paymentRes.data.data.payment.id;
  assert.equal(paymentRes.data.data.payment.status, 'PENDING');

  const paymentsListRes = await request('GET', '/api/vehicle-payments?page=1&limit=20', null, adminToken);
  assert.equal(paymentsListRes.status, 200, 'Department payments should be available as a paginated collection');
  assert.ok(paymentsListRes.data.data.items.some((payment) => payment.id === paymentId), 'Payment list should include the linked reservation payment');

  const validationRes = await request('POST', `/api/vehicle-payments/${paymentId}/validate`, null, adminToken);
  assert.equal(validationRes.status, 200, 'Payment validation should succeed');
  assert.equal(validationRes.data.data.payment.status, 'VERIFIED');

  const reservationAfterPayment = await request('GET', `/api/vehicle-reservations/${reservationId}`, null, adminToken);
  assert.equal(reservationAfterPayment.status, 200, 'Reservation should be readable after payment validation');
  assert.equal(reservationAfterPayment.data.data.vehicleReservation.paymentStatus, 'COMPLETED');

  const confirmReservationRes = await request('PUT', `/api/vehicle-reservations/${reservationId}`, {
    status: 'CONFIRMED',
  }, adminToken);
  assert.equal(confirmReservationRes.status, 200, 'Reservation should be confirmable');
  assert.equal(confirmReservationRes.data.data.vehicleReservation.status, 'CONFIRMED');

  const finalSaleRes = await request('PUT', `/api/vehicle-reservations/${reservationId}`, {
    status: 'COMPLETED',
  }, adminToken);
  assert.equal(finalSaleRes.status, 200, 'Reservation should be able to reach COMPLETED');
  assert.equal(finalSaleRes.data.data.vehicleReservation.status, 'COMPLETED');

  const vehicleAfterSale = await request('GET', `/api/vehicles/${vehicleId}`, null, adminToken);
  assert.equal(vehicleAfterSale.status, 200, 'Vehicle should be readable after sale');
  assert.equal(vehicleAfterSale.data.data.vehicle.status, 'SOLD', 'Vehicle must be marked SOLD after sale completion');

  const inquiryAfterSale = await request('GET', `/api/vehicle-inquiries/${inquiryId}`, null, adminToken);
  assert.equal(inquiryAfterSale.status, 200, 'Inquiry should remain accessible after sale');
  assert.equal(inquiryAfterSale.data.data.vehicleInquiry.status, 'CONVERTED', 'Final sale must convert the inquiry');

  const finalDashboard = await request('GET', '/api/dashboard/autosales', null, adminToken);
  assert.equal(finalDashboard.status, 200, 'AutoSales dashboard should refresh after a sale');
  assert.ok(finalDashboard.data.data.sales.count >= 1, 'Only finalized reservations should count as sales');
});
