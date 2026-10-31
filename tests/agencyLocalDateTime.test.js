'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { agencyLocalDateTimeToUtc } = require('../src/utils/agencyLocalDateTime');

test('agency local departure time resolves consistently across host time zones', () => {
  const previous = process.env.TZ;
  try {
    const instants = ['UTC', 'Africa/Kinshasa', 'America/Los_Angeles'].map((hostZone) => {
      process.env.TZ = hostZone;
      return agencyLocalDateTimeToUtc('2027-02-10', '07:30', 'Africa/Kinshasa').toISOString();
    });
    assert.deepEqual(new Set(instants).size, 1);
    assert.equal(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kinshasa', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instants[0])), '07:30');
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});

test('rejects malformed local date and time values', () => {
  assert.throws(() => agencyLocalDateTimeToUtc('2027-02-10', '25:30', 'UTC'), RangeError);
  assert.throws(() => agencyLocalDateTimeToUtc('not-a-date', '07:30', 'UTC'), RangeError);
});
