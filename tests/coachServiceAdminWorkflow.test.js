const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let buildCoachServiceAdminNav;
let calculateTripArrivalAt;
test.before(async () => {
  ({ buildCoachServiceAdminNav, calculateTripArrivalAt } = await import('../admin-frontend/src/features/admin/coach/coachAdminWorkflow.mjs'));
});
const labels = new Proxy({}, { get: (_target, key) => key });
const icons = new Proxy({}, { get: (_target, key) => key });

test('Coach Service Admin navigation has six unique main destinations in the required order', () => {
  const nav = buildCoachServiceAdminNav({ t: (key) => labels[key], can: () => true, icons });
  assert.deepEqual(nav.map((section) => section.title), [
    'coachAdminNav.dashboard', 'coachAdminNav.travel', 'coachAdminNav.finance',
    'coachAdminNav.tickets', 'coachAdminNav.parcels', 'coachAdminNav.account',
  ]);
  const paths = nav.flatMap((section) => [section.standalone?.path, ...section.items.map((item) => item.path)].filter(Boolean));
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(paths.filter((route) => route === '/admin/account').length, 1);
});

test('Coach navigation hides entries without the relevant permission', () => {
  const nav = buildCoachServiceAdminNav({ t: (key) => key, can: (permission) => permission === 'VIEW_PAYMENT', icons });
  assert.equal(nav.find((section) => section.id === 'coach-travel').items.some((item) => item.path === '/transport/trips'), false);
  assert.equal(nav.find((section) => section.id === 'coach-finance').items.some((item) => item.path === '/transport/payments'), true);
  assert.equal(nav.find((section) => section.id === 'coach-tickets').items.length, 0);
});

test('Trip arrival is calculated from the selected schedule and date, with duration fallback', () => {
  assert.match(calculateTripArrivalAt('2026-10-22', '08:15', 4), /T12:15$/);
  assert.match(calculateTripArrivalAt('2026-10-22', '23:30', 2), /2026-10-23T01:30$/);
  assert.match(calculateTripArrivalAt('2026-10-22', '08:15', null), /T10:15$/);
  assert.equal(calculateTripArrivalAt('2026-10-22', '', 4), '');
});

test('Coach navbar and trip form stay within their required interaction rules', () => {
  const root = path.resolve(__dirname, '..');
  const layout = fs.readFileSync(path.join(root, 'admin-frontend/src/layouts/AdminLayout.jsx'), 'utf8');
  const form = fs.readFileSync(path.join(root, 'admin-frontend/src/features/resources/DynamicResourceForm.jsx'), 'utf8');
  assert.match(layout, /!isCoachAgent && !isCoachManager && !isCoachServiceAdmin/);
  assert.match(layout, /isCoachServiceAdmin \? '' : 'hide-on-mobile'/);
  assert.match(form, /queryKey: \['coach-trip-schedule-details', formData\.scheduleId\]/);
  assert.match(form, /scheduleId: value, arrivalAt: ''/);
});
