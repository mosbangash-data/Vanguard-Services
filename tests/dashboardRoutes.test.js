const test = require('node:test');
const assert = require('node:assert/strict');

const authPath = require.resolve('../src/middleware/authMiddleware');
const permissionPath = require.resolve('../src/middleware/permissionMiddleware');
const dashboardControllerPath = require.resolve('../src/controllers/dashboardController');
const managerControllerPath = require.resolve('../src/controllers/managerDashboardController');
const staffControllerPath = require.resolve('../src/controllers/agencyStaffController');
const cashClosureRoutesPath = require.resolve('../src/routes/cashClosures');
const express = require('express');
const originalModules = new Map([
  [authPath, require.cache[authPath]],
  [permissionPath, require.cache[permissionPath]],
  [dashboardControllerPath, require.cache[dashboardControllerPath]],
  [managerControllerPath, require.cache[managerControllerPath]],
  [staffControllerPath, require.cache[staffControllerPath]],
  [cashClosureRoutesPath, require.cache[cashClosureRoutesPath]],
]);

require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { authenticateToken: (_req, _res, next) => next() } };
require.cache[permissionPath] = {
  id: permissionPath,
  filename: permissionPath,
  loaded: true,
  exports: {
    requireRole: (...roles) => {
      const middleware = (_req, _res, next) => next();
      middleware.allowedRoles = roles;
      return middleware;
    },
  },
};
require.cache[dashboardControllerPath] = { id: dashboardControllerPath, filename: dashboardControllerPath, loaded: true, exports: { overview: () => {}, coachSalesReport: () => {} } };
require.cache[managerControllerPath] = { id: managerControllerPath, filename: managerControllerPath, loaded: true, exports: { getManagerDashboard: () => {} } };
require.cache[staffControllerPath] = { id: staffControllerPath, filename: staffControllerPath, loaded: true, exports: { list: () => {}, create: () => {}, get: () => {}, update: () => {}, updateStatus: () => {}, listAttendance: () => {}, upsertAttendance: () => {} } };
require.cache[cashClosureRoutesPath] = { id: cashClosureRoutesPath, filename: cashClosureRoutesPath, loaded: true, exports: express.Router() };

delete require.cache[require.resolve('../src/routes/dashboard')];
delete require.cache[require.resolve('../src/routes/managerDashboard')];
const dashboardRouter = require('../src/routes/dashboard');
const managerDashboardRouter = require('../src/routes/managerDashboard');

const routeFor = (router, path) => router.stack.find((layer) => layer.route?.path === path)?.route;
const roleGuardFor = (route) => route?.stack.find((layer) => layer.handle.allowedRoles)?.handle.allowedRoles;

test('dashboard endpoints keep Service Admin and Manager role guards distinct', () => {
  assert.deepEqual(roleGuardFor(routeFor(dashboardRouter, '/service-admin')), ['SERVICE_ADMIN']);
  assert.deepEqual(roleGuardFor(routeFor(managerDashboardRouter, '/dashboard')), ['MANAGER']);
});

test.after(() => {
  for (const [path, original] of originalModules) {
    if (original) require.cache[path] = original;
    else delete require.cache[path];
  }
  delete require.cache[require.resolve('../src/routes/dashboard')];
  delete require.cache[require.resolve('../src/routes/managerDashboard')];
});
