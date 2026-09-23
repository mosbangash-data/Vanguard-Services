import test from 'node:test';
import assert from 'node:assert/strict';

import { getDestination } from './routeRules.mjs';

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

test('SUPER_ADMIN users are redirected to /admin', () => {
  const destination = getDestination({
    role: 'SUPER_ADMIN',
  });

  assert.equal(destination, '/admin');
});
