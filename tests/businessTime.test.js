const test = require('node:test');
const assert = require('node:assert/strict');
const { dateKeyAt, parseDateKey, businessDayRange, addDateKeyDays } = require('../src/utils/businessTime');

test('Africa/Kinshasa business-day bounds include instants close to midnight', () => {
  const range = businessDayRange('2026-10-10');
  assert.ok(range);
  assert.equal(dateKeyAt(range.start), '2026-10-10');
  assert.equal(dateKeyAt(new Date(range.end.getTime() - 1)), '2026-10-10');
  assert.equal(dateKeyAt(range.end), '2026-10-11');
  assert.equal(range.end.getTime() - range.start.getTime(), 24 * 60 * 60 * 1000);
});

test('business-day helpers reject impossible calendar dates and cross month boundaries', () => {
  assert.equal(parseDateKey('2026-02-30'), null);
  assert.equal(businessDayRange('not-a-date'), null);
  assert.equal(addDateKeyDays('2026-03-01', -1), '2026-02-28');
});
