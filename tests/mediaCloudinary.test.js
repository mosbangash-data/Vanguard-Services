const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCloudinaryFolder, sanitizeDepartment } = require('../src/services/cloudinaryService');

test('buildCloudinaryFolder builds the department-aware Cloudinary path', () => {
  const folder = buildCloudinaryFolder({
    department: 'AUTO_SALES',
    entityType: 'vehicle',
    entityId: 'veh_123',
  });

  assert.equal(folder, 'vanguard-services/AUTO_SALES/vehicles/veh_123');
});

test('sanitizeDepartment rejects invalid department names', () => {
  assert.throws(() => sanitizeDepartment('ADMIN_SECRET'), /Department/i);
  assert.equal(sanitizeDepartment('AUTO_SALES'), 'AUTO_SALES');
});
