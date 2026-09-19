const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'vehicle-media-test-jwt';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'vehicle-media-test-session';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/vehicle_media_test';

const { mediaMatchesEntity } = require('../src/services/vehicleMediaService');

const expected = {
  entityType: 'vehicle',
  entityId: 'vehicle-1',
  department: 'AUTO_SALES',
};

test('vehicle media validation accepts a matching Media', () => {
  assert.equal(mediaMatchesEntity({ ...expected }, expected.entityType, expected.entityId, expected.department), true);
});

test('vehicle media validation rejects a wrong entityType', () => {
  assert.equal(mediaMatchesEntity({ ...expected, entityType: 'project' }, expected.entityType, expected.entityId, expected.department), false);
});

test('vehicle media validation rejects a wrong entityId', () => {
  assert.equal(mediaMatchesEntity({ ...expected, entityId: 'vehicle-2' }, expected.entityType, expected.entityId, expected.department), false);
});

test('vehicle media validation rejects a wrong department', () => {
  assert.equal(mediaMatchesEntity({ ...expected, department: 'CONSTRUCTION' }, expected.entityType, expected.entityId, expected.department), false);
});

test('vehicle media validation rejects a missing Media', () => {
  assert.equal(mediaMatchesEntity(null, expected.entityType, expected.entityId, expected.department), false);
});