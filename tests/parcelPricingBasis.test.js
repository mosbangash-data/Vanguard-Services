const test = require('node:test');
const assert = require('node:assert/strict');
const { applyPricingBasis, calculateOfficialPrice } = require('../src/services/parcelPricingService');

test('weight-based parcel pricing ignores volume', async () => {
  const dimensions = applyPricingBasis('WEIGHT', 3, 0.5);
  assert.deepEqual(dimensions, { weightKg: 3, volumeM3: 0 });
  const price = await calculateOfficialPrice(dimensions);
  assert.equal(price.amount, '8.00');
});

test('volume-based parcel pricing ignores weight', async () => {
  const dimensions = applyPricingBasis('VOLUME', 20, 0.11);
  assert.deepEqual(dimensions, { weightKg: 0, volumeM3: 0.11 });
  const price = await calculateOfficialPrice(dimensions);
  assert.equal(price.amount, '10.00');
});

