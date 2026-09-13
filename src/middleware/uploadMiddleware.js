const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AppError } = require('./errorHandler');

const UPLOAD_DIR = path.join(__dirname, '../../public/uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
]);

const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Parses multipart/form-data from incoming request buffer.
 */
const parseMultipart = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return next();
  }

  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    return next(new AppError('Invalid multipart/form-data boundary', 400));
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

  const chunks = [];
  let totalSize = 0;

  req.on('data', (chunk) => {
    totalSize += chunk.length;
    if (totalSize > MAX_FILE_SIZE + 65536) {
      req.destroy(new AppError('Uploaded content exceeds size limit (10MB)', 413));
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      req.body = req.body || {};
      req.files = [];

      let start = 0;
      while (start < buffer.length) {
        const boundaryIndex = buffer.indexOf(boundaryBuffer, start);
        if (boundaryIndex === -1) break;

        // Check if this is the end boundary
        if (buffer.indexOf(endBoundaryBuffer, start) === boundaryIndex) {
          break;
        }

        const partStart = boundaryIndex + boundaryBuffer.length + 2; // skip \r\n
        const nextBoundaryIndex = buffer.indexOf(Buffer.from(`\r\n--${boundary}`), partStart);
        if (nextBoundaryIndex === -1) break;

        const partBuffer = buffer.slice(partStart, nextBoundaryIndex);
        const headerEndIndex = partBuffer.indexOf(Buffer.from('\r\n\r\n'));

        if (headerEndIndex !== -1) {
          const headerStr = partBuffer.slice(0, headerEndIndex).toString('utf8');
          const bodyBuffer = partBuffer.slice(headerEndIndex + 4);

          // Parse Content-Disposition
          const dispositionMatch = headerStr.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
          if (dispositionMatch) {
            const fieldName = dispositionMatch[1];
            const originalFilename = dispositionMatch[2];

            if (originalFilename !== undefined && originalFilename !== '') {
              // File part
              const typeMatch = headerStr.match(/Content-Type:\s*([^\r\n;]+)/i);
              const mimeType = (typeMatch ? typeMatch[1].trim() : 'application/octet-stream').toLowerCase();

              if (!ALLOWED_MIME_TYPES.has(mimeType)) {
                return next(new AppError(`Unsupported file type: ${mimeType}. Allowed: JPEG, PNG, WEBP, GIF, MP4`, 400));
              }

              if (bodyBuffer.length > MAX_FILE_SIZE) {
                return next(new AppError('File exceeds maximum size limit (10MB)', 413));
              }

              const ext = MIME_EXTENSIONS[mimeType] || path.extname(originalFilename).toLowerCase() || '.bin';
              const secureFilename = `${crypto.randomUUID()}${ext}`;
              const filePath = path.join(UPLOAD_DIR, secureFilename);

              fs.writeFileSync(filePath, bodyBuffer);

              const fileInfo = {
                fieldname: fieldName,
                originalname: path.basename(originalFilename),
                filename: secureFilename,
                mimetype: mimeType,
                size: bodyBuffer.length,
                path: filePath,
                url: `/uploads/${secureFilename}`,
              };

              req.files.push(fileInfo);
              if (!req.file) {
                req.file = fileInfo;
              }
            } else {
              // Standard text field
              req.body[fieldName] = bodyBuffer.toString('utf8');
            }
          }
        }

        start = nextBoundaryIndex + 2;
      }

      return next();
    } catch (err) {
      return next(err);
    }
  });

  req.on('error', (err) => {
    next(err);
  });
};

module.exports = {
  parseMultipart,
  UPLOAD_DIR,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
};
