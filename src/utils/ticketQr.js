const crypto = require('crypto');

const QR_VERSION = 2;
const QR_FIELDS = ['v', 'ticketCode', 'ticketId', 'tripId', 'issuedAt', 'expiresAt', 'nonce'];
const signPayload = (payload, secret) => crypto.createHmac('sha256', secret)
  .update(JSON.stringify(payload)).digest('base64url');

const buildSignedTicketQr = ({ ticketCode, ticketId, tripId, issuedAt, expiresAt }, secret) => {
  if (!secret || typeof secret !== 'string') throw new Error('TICKET_QR_SECRET is required');
  const payload = {
    v: QR_VERSION,
    ticketCode,
    ticketId,
    tripId,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    nonce: crypto.randomBytes(16).toString('base64url'),
  };
  return JSON.stringify({ ...payload, sig: signPayload(payload, secret) });
};

const parseSignedTicketQr = (value, secret, now = Date.now()) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048 || !secret) return null;
  let parsed;
  try { parsed = JSON.parse(value); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || Object.keys(parsed).sort().join(',') !== [...QR_FIELDS, 'sig'].sort().join(',')
    || parsed.v !== QR_VERSION || typeof parsed.sig !== 'string'
    || QR_FIELDS.some((field) => typeof parsed[field] !== (field === 'v' ? 'number' : 'string'))
    || !/^[A-Za-z0-9_-]{22}$/.test(parsed.nonce)) return null;

  const payload = Object.fromEntries(QR_FIELDS.map((field) => [field, parsed[field]]));
  const expected = Buffer.from(signPayload(payload, secret));
  const provided = Buffer.from(parsed.sig);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) return null;

  const issuedAt = Date.parse(parsed.issuedAt);
  const expiresAt = Date.parse(parsed.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)
    || new Date(issuedAt).toISOString() !== parsed.issuedAt
    || new Date(expiresAt).toISOString() !== parsed.expiresAt
    || expiresAt <= now || issuedAt > now + 60_000 || expiresAt <= issuedAt) return null;
  return parsed;
};

const verifyTicketQrSignature = (value, ticketCode, secret, now) => {
  const payload = parseSignedTicketQr(value, secret, now);
  return Boolean(payload && payload.ticketCode === ticketCode);
};

const extractTicketCodeFromQr = (value, secret, now) => parseSignedTicketQr(value, secret, now)?.ticketCode || null;

module.exports = { buildSignedTicketQr, parseSignedTicketQr, verifyTicketQrSignature, extractTicketCodeFromQr };
