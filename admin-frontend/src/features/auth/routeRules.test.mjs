import test from 'node:test';
import assert from 'node:assert/strict';

import { getCoachDashboardEndpoint, getDestination } from './routeRules.mjs';

test('AGENT coach users are redirected to /transport/agent', () => {
  const destination = getDestination({
    role: 'AGENT',
    department: { type: 'VANGUARD_COACH' },
  });

  assert.equal(destination, '/transport/agent');
});

test('SERVICE_ADMIN coach users are redirected to /transport', () => {
  const destination = getDestination({
    role: 'SERVICE_ADMIN',
    department: { type: 'VANGUARD_COACH' },
  });

  assert.equal(destination, '/transport');
});

test('dashboard requests use the Service Admin endpoint for SERVICE_ADMIN and the Manager endpoint for MANAGER', () => {
  assert.equal(getCoachDashboardEndpoint({ role: 'SERVICE_ADMIN' }), '/api/dashboard/service-admin');
  assert.equal(getCoachDashboardEndpoint({ role: 'MANAGER' }), '/api/manager/dashboard');
});

test('SUPER_ADMIN users are redirected to /admin', () => {
  const destination = getDestination({
    role: 'SUPER_ADMIN',
  });

  assert.equal(destination, '/admin');
});
