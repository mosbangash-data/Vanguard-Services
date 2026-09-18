const path = require('path');
const { AppError } = require('./errorHandler');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MIME_EXTENSIONS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const hasImageSignature = (buffer, mimeType) => {
  if (mimeType === 'image/jpeg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
};

/**
 * Parses multipart/form-data in memory. Cloudinary is the durable store;
 * keeping the buffer on the request avoids writing persistent local files.
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
    if (totalSize > (MAX_FILE_SIZE * 12) + 65536) {
    req.destroy(new AppError('Uploaded content exceeds size limit', 413));
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
                return next(new AppError(`Unsupported file type: ${mimeType}. Allowed: JPEG, PNG, WEBP, GIF`, 400));
              }

              if (bodyBuffer.length > MAX_FILE_SIZE) {
                return next(new AppError('File exceeds maximum size limit (10MB)', 413));
              }

              const ext = path.extname(path.basename(originalFilename)).toLowerCase();
              const expectedExt = MIME_EXTENSIONS[mimeType] || [];
              if (!expectedExt.includes(ext)) {
                return next(new AppError(`File extension does not match MIME type: ${mimeType}`, 400));
              }
              if (!hasImageSignature(bodyBuffer, mimeType)) {
                return next(new AppError('File content does not match its declared image type', 422));
              }

              const fileInfo = {
                fieldname: fieldName,
                originalname: path.basename(originalFilename),
                mimetype: mimeType,
                size: bodyBuffer.length,
                buffer: bodyBuffer,
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
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
};
