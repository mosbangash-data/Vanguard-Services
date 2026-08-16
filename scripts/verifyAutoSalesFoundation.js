const http = require('http');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const marker = `AUTO-${Date.now()}`;
let server;
const request = async (base, method, path, body, token) => {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, data };
};
const expect = (value, status, label) => { if (value.status !== status) throw new Error(`${label}: expected ${status}, got ${value.status}`); return value; };

(async () => {
  const department = await prisma.department.findUnique({ where: { type: 'AUTO_SALES' } });
  const role = await prisma.role.findUnique({ where: { name: 'AGENT' } });
  if (!department || !role) throw new Error('AutoSales department or AGENT role missing');
  const email = `autosales.${marker.toLowerCase()}@vanguard.local`;
  const agent = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(`Auto-${marker}!`, 10), firstName: 'Auto', lastName: 'Agent', roleId: role.id, departmentId: department.id, status: 'ACTIVE', firstLogin: false } });
  server = http.createServer(app); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const admin = expect(await request(base, 'POST', '/api/auth/login', { identifier: 'admin@vanguard.local', password: 'Admin123!' }), 200, 'admin login').data.data.token;
  const agentToken = expect(await request(base, 'POST', '/api/auth/login', { identifier: email, password: `Auto-${marker}!` }), 200, 'agent login').data.data.token;
  const vehicle = expect(await request(base, 'POST', '/api/vehicles', { departmentId: department.id, brand: 'Toyota', model: marker, year: 2025, price: '18000.00', currency: 'USD', mileage: 0, fuelType: 'Petrol', transmission: 'Automatic', color: 'White', description: 'AutoSales foundation verification vehicle.' }, admin), 201, 'vehicle create').data.data.vehicle;
  const readVehicle = expect(await request(base, 'GET', `/api/vehicles/${vehicle.id}`, undefined, admin), 200, 'vehicle read').data.data.vehicle;
  expect(await request(base, 'PATCH', `/api/vehicles/${vehicle.id}`, { status: 'RESERVED' }, admin), 200, 'reserve vehicle');
  const sold = expect(await request(base, 'PATCH', `/api/vehicles/${vehicle.id}`, { status: 'SOLD' }, admin), 200, 'sell vehicle').data.data.vehicle;
  const inquiryVehicle = expect(await request(base, 'POST', '/api/vehicles', { departmentId: department.id, brand: 'Honda', model: `${marker}-INQ`, year: 2025, price: '12000.00', currency: 'USD', mileage: 10, description: 'Inquiry verification vehicle.' }, admin), 201, 'inquiry vehicle create').data.data.vehicle;
  const disposableVehicle = expect(await request(base, 'POST', '/api/vehicles', { departmentId: department.id, brand: 'Nissan', model: `${marker}-DELETE`, year: 2025, price: '9000.00', currency: 'USD', mileage: 0, description: 'Disposable CRUD verification vehicle.' }, admin), 201, 'disposable vehicle create').data.data.vehicle;
  const deletedVehicle = expect(await request(base, 'DELETE', `/api/vehicles/${disposableVehicle.id}`, undefined, admin), 200, 'vehicle delete');
  const inquiry = expect(await request(base, 'POST', '/api/vehicle-inquiries', { vehicleId: inquiryVehicle.id, customerName: 'AutoSales Test Customer', customerPhone: '0800000000', customerEmail: 'autosales.test@example.com', inquiryType: 'INFORMATION', message: 'I would like to receive more vehicle information.' }, admin), 201, 'inquiry create').data.data.vehicleInquiry;
  const assigned = expect(await request(base, 'PATCH', `/api/vehicle-inquiries/${inquiry.id}/assign`, { assignedToUserId: agent.id }, admin), 200, 'inquiry assignment').data.data.vehicleInquiry;
  const visible = expect(await request(base, 'GET', `/api/vehicle-inquiries?assignedToUserId=${agent.id}`, undefined, agentToken), 200, 'agent inquiry listing').data.data.items;
  const updated = expect(await request(base, 'PATCH', `/api/vehicle-inquiries/${inquiry.id}`, { status: 'CONTACTED', internalNotes: 'Customer contacted by assigned AutoSales agent.' }, agentToken), 200, 'agent inquiry update').data.data.vehicleInquiry;
  const coachDenied = await request(base, 'GET', '/api/tickets', undefined, agentToken);
  const publicVehicles = expect(await request(base, 'GET', '/api/vehicles', undefined, undefined), 200, 'public vehicle listing').data.data.items;
  console.log(JSON.stringify({ marker, ids: { agentId: agent.id, vehicleId: vehicle.id, inquiryId: inquiry.id }, checks: { vehicleCurrency: vehicle.currency, vehicleRead: readVehicle.id === vehicle.id, vehicleDeleted: deletedVehicle.data.data.success === true, soldStatus: sold.status, inquiryNew: inquiry.status, assignedToAgent: assigned.assignedToUserId === agent.id, agentSeesAssignedInquiry: visible.some((item) => item.id === inquiry.id), inquiryStatus: updated.status, coachDenied: coachDenied.status, soldNotPublic: !publicVehicles.some((item) => item.id === vehicle.id) } }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await prisma.$disconnect(); });
