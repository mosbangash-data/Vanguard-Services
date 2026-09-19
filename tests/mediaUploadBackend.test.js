const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  hasImageSignature,
} = require('../src/middleware/uploadMiddleware');
const {
  buildCloudinaryFolder,
} = require('../src/services/cloudinaryService');

test('media upload accepts only the supported image MIME whitelist', () => {
  assert.deepEqual([...ALLOWED_MIME_TYPES].sort(), [
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
  assert.equal(ALLOWED_MIME_TYPES.has('video/mp4'), false);
});

test('media upload validates JPEG, PNG, GIF and WEBP signatures', () => {
  assert.equal(hasImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg'), true);
  assert.equal(hasImageSignature(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'), true);
  assert.equal(hasImageSignature(Buffer.from('GIF89a'), 'image/gif'), true);
  assert.equal(hasImageSignature(Buffer.from('RIFFxxxxWEBP'), 'image/webp'), true);
  assert.equal(hasImageSignature(Buffer.from('not-an-image'), 'image/png'), false);
});

test('Cloudinary folders are computed by the backend from canonical entity values', () => {
  assert.equal(
    buildCloudinaryFolder({ department: 'AUTO_SALES', entityType: 'vehicle', entityId: 'vehicle-1' }),
    'vanguard-services/AUTO_SALES/vehicles/vehicle-1',
  );
  assert.equal(
    buildCloudinaryFolder({ department: 'CONSTRUCTION', entityType: 'project', entityId: 'project-1' }),
    'vanguard-services/CONSTRUCTION/projects/project-1',
  );
  assert.equal(
    buildCloudinaryFolder({ department: 'VANGUARD_COACH', entityType: 'bus', entityId: 'bus-1' }),
    'vanguard-services/VANGUARD_COACH/buses/bus-1',
  );
});

test('media upload enforces the ten megabyte backend limit', () => {
  assert.equal(MAX_FILE_SIZE, 10 * 1024 * 1024);
});