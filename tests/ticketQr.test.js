const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSignedTicketQr,
  parseSignedTicketQr,
  verifyTicketQrSignature,
  extractTicketCodeFromQr,
} = require('../src/utils/ticketQr');

const secret = 'test-only-ticket-qr-signing-secret-that-is-long-enough';
const issuedAt = new Date('2026-10-05T10:00:00.000Z');
const expiresAt = new Date('2026-10-06T10:00:00.000Z');
const issue = (overrides = {}) => buildSignedTicketQr({
  ticketCode: 'VG-0123456789ABCDEF',
  ticketId: 'ticket-123',
  tripId: 'trip-456',
  issuedAt,
  expiresAt,
  ...overrides,
}, secret);

test('v2 signed ticket QR verifies and exposes only its signed ticket code', () => {
  const qr = issue();
  const payload = parseSignedTicketQr(qr, secret, issuedAt.getTime() + 1000);
  assert.equal(payload.v, 2);
  assert.equal(payload.ticketCode, 'VG-0123456789ABCDEF');
  assert.equal(extractTicketCodeFromQr(qr, secret, issuedAt.getTime() + 1000), payload.ticketCode);
  assert.equal(verifyTicketQrSignature(qr, payload.ticketCode, secret, issuedAt.getTime() + 1000), true);
});

test('unsigned, legacy, empty, truncated, and extra-field QRs are rejected', () => {
  const qr = issue();
  const withExtra = { ...JSON.parse(qr), forged: true };
  for (const value of ['', 'vanguard://ticket/TCK-OLD', 'VG-0123456789ABCDEF', qr.slice(0, -8), JSON.stringify(withExtra)]) {
    assert.equal(parseSignedTicketQr(value, secret, issuedAt.getTime() + 1000), null);
  }
});

test('signature and every identity field are protected', () => {
  const qr = issue();
  const original = JSON.parse(qr);
  const changedSig = { ...original, sig: `${original.sig.slice(0, -1)}${original.sig.endsWith('A') ? 'B' : 'A'}` };
  assert.equal(parseSignedTicketQr(JSON.stringify(changedSig), secret, issuedAt.getTime() + 1000), null);
  for (const field of ['ticketCode', 'ticketId', 'tripId']) {
    const changed = { ...original, [field]: `${original[field]}-changed` };
    assert.equal(parseSignedTicketQr(JSON.stringify(changed), secret, issuedAt.getTime() + 1000), null);
  }
  assert.equal(verifyTicketQrSignature(qr, 'VG-FFFFFFFFFFFFFFFF', secret, issuedAt.getTime() + 1000), false);
});

test('expired and unsupported-version QRs are rejected', () => {
  const qr = issue();
  assert.equal(parseSignedTicketQr(qr, secret, expiresAt.getTime()), null);
  const unsupported = { ...JSON.parse(qr), v: 1 };
  assert.equal(parseSignedTicketQr(JSON.stringify(unsupported), secret, issuedAt.getTime() + 1000), null);
});
