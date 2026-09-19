const path = require('path');
const multer = require('multer');
const { AppError } = require('./errorHandler');
const { MAX_FILE_SIZE, MAX_FILES, ALLOWED_MIME_TYPES, MIME_EXTENSIONS, IMAGE_SIGNATURES } = require('../config/media');

const hasImageSignature = (buffer, mimeType) => Boolean(IMAGE_SIGNATURES[mimeType]?.(buffer));

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
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_COUNT') {
        return next(new AppError(`A maximum of ${MAX_FILES} files can be uploaded at once`, 400));
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