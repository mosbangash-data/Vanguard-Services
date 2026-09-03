const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Get or derive a 32-byte encryption key from environment variable or session secret.
 */
const getEncryptionKey = () => {
  const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || process.env.JWT_SECRET || 'vanguard-services-default-crypto-key-32b';
  return crypto.createHash('sha256').update(String(secret)).digest();
};

/**
 * Encrypt sensitive text at rest using AES-256-GCM.
 * Output format: iv_hex:authTag_hex:encrypted_hex
 */
const encryptSensitiveData = (plainText) => {
  if (plainText === undefined || plainText === null || plainText === '') return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(String(plainText), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

/**
 * Decrypt sensitive text encrypted with AES-256-GCM.
 */
const decryptSensitiveData = (encryptedString) => {
  if (!encryptedString || typeof encryptedString !== 'string') return null;
  const parts = encryptedString.split(':');
  if (parts.length !== 3) return null;
  const [ivHex, authTagHex, encryptedHex] = parts;
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
};

/**
 * Mask sensitive ID numbers for non-privileged displays (e.g. "****5678").
 */
const maskIdNumber = (idNumber) => {
  if (!idNumber || typeof idNumber !== 'string') return '****';
  const trimmed = idNumber.trim();
  if (trimmed.length <= 4) return '****';
  const visiblePart = trimmed.slice(-4);
  return `${'*'.repeat(Math.max(trimmed.length - 4, 4))}${visiblePart}`;
};

/**
 * Generate a cryptographically secure, collision-resistant tracking code.
 * Format: PRC-[4HEX]-[TIMESTAMP36]-[4HEX] (e.g., PRC-A8F2-M1K9L4-7E3B)
 */
const generateSecureTrackingCode = () => {
  const p1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const p2 = Date.now().toString(36).toUpperCase();
  const p3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `PRC-${p1}-${p2}-${p3}`;
};

module.exports = {
  encryptSensitiveData,
  decryptSensitiveData,
  maskIdNumber,
  generateSecureTrackingCode,
};
