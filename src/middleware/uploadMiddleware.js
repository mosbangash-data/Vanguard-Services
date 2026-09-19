const path = require('path');
const multer = require('multer');
const { AppError } = require('./errorHandler');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MIME_EXTENSIONS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 12;

const hasImageSignature = (buffer, mimeType) => {
  if (mimeType === 'image/jpeg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (req, file, callback) => {
    const mimeType = file.mimetype.toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      callback(new AppError(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, GIF`, 400));
      return;
    }
    const extension = path.extname(path.basename(file.originalname)).toLowerCase();
    if (!MIME_EXTENSIONS[mimeType]?.includes(extension)) {
      callback(new AppError(`File extension does not match MIME type: ${file.mimetype}`, 400));
      return;
    }
    callback(null, true);
  },
});

const validateFileContents = (req, res, next) => {
  const files = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);
  for (const file of files) {
    if (!hasImageSignature(file.buffer, file.mimetype.toLowerCase())) {
      return next(new AppError('File content does not match its declared image type', 422));
    }
  }
  return next();
};

const parseMultipart = (req, res, next) => {
  upload.array('file', MAX_FILES)(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File exceeds maximum size limit (10MB)', 413));
      }
      return next(error);
    }
    return validateFileContents(req, res, next);
  });
};

module.exports = {
  parseMultipart,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_FILES,
  hasImageSignature,
};