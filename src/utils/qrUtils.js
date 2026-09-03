const crypto = require('crypto');

/**
 * Get the secret used for signing QR codes and verification tokens.
 */
const getQrSigningSecret = () => {
  return process.env.QR_SIGNING_SECRET || process.env.JWT_SECRET || 'vanguard-services-qr-signing-secret';
};

/**
 * Generate a cryptographically signed QR code payload.
 * Format: vanguard://{resourceType}/{identifier}.{signature}
 */
const buildSignedQrPayload = (resourceType, identifier) => {
  if (!resourceType || !identifier) return null;
  const secret = getQrSigningSecret();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${resourceType}:${identifier}`)
    .digest('hex')
    .slice(0, 16); // 16-char truncated HMAC
  return `vanguard://${resourceType}/${identifier}.${signature}`;
};

/**
 * Verify a signed QR code payload and extract the verified identifier.
 */
const verifySignedQrPayload = (qrPayload, expectedResourceType) => {
  if (!qrPayload || typeof qrPayload !== 'string') return null;
  const match = qrPayload.trim().match(/^vanguard:\/\/([a-z-]+)\/([A-Za-z0-9_-]+)(?:\.([a-f0-9]+))?$/i);
  if (!match) return null;

  const [, resourceType, identifier, signature] = match;
  if (expectedResourceType && resourceType.toLowerCase() !== expectedResourceType.toLowerCase()) {
    return null;
  }

  // If a signature is present, verify it
  if (signature) {
    const secret = getQrSigningSecret();
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${resourceType}:${identifier}`)
      .digest('hex')
      .slice(0, 16);
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSig, 'utf8'))) {
      return null;
    }
  }

  return { resourceType, identifier };
};

module.exports = {
  buildSignedQrPayload,
  verifySignedQrPayload,
};
