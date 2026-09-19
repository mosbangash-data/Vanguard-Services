const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 12;

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MIME_EXTENSIONS = Object.freeze({
  'image/jpeg': Object.freeze(['.jpg', '.jpeg']),
  'image/png': Object.freeze(['.png']),
  'image/webp': Object.freeze(['.webp']),
  'image/gif': Object.freeze(['.gif']),
});
const IMAGE_SIGNATURES = Object.freeze({
  'image/jpeg': (buffer) => buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/gif': (buffer) => ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii')),
  'image/webp': (buffer) => buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP',
});

module.exports = {
  MAX_FILE_SIZE,
  MAX_FILES,
  ALLOWED_MIME_TYPES,
  MIME_EXTENSIONS,
  IMAGE_SIGNATURES,
  SUPPORTED_ENTITY_TYPES: new Set(['vehicle', 'bus', 'project', 'general']),
  GENERAL_ENTITY_ID: 'generic',
};