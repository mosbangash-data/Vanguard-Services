'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCitySearch, cityMatchesSearch } = require('../src/utils/normalizeCitySearch');

test('city search ignores case, accents and repeated whitespace', () => {
  assert.equal(cityMatchesSearch('  Lubumbáshi   Centre ', 'lubumbashi centre'), true);
  assert.equal(cityMatchesSearch('Dar Es Salaam', '  dar   es salaam '), true);
  assert.equal(normalizeCitySearch('ÉCOLE'), 'ecole');
});

test('city search keeps partial matching contiguous and rejects unrelated destinations', () => {
  assert.equal(cityMatchesSearch('Dar Es Salaam', 'salaam'), true);
  assert.equal(cityMatchesSearch('Dar Es Salaam', 'dar kampala'), false);
  assert.equal(cityMatchesSearch('Bukavu', ''), true);
});
