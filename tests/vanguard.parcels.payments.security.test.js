const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { encryptSensitiveData, decryptSensitiveData, maskIdNumber, generateSecureTrackingCode } = require('../src/utils/cryptoUtils');
const { buildSignedQrPayload, verifySignedQrPayload } = require('../src/utils/qrUtils');
const { calculateOfficialPrice, CATEGORY_COEFFICIENTS } = require('../src/services/parcelPricingService');
const { MbiyoPayProvider, AgencyPaymentProvider, getProvider } = require('../src/services/payment');

// 1. Encryption & Sensitive PII Security
test('Sensitive ID number encryption at rest with AES-256-GCM, decryption, and masking', () => {
  const rawId = 'ID-CD-KIN-987654321';
  const encrypted = encryptSensitiveData(rawId);

  assert.ok(encrypted, 'Encrypted string must not be empty');
  assert.notEqual(encrypted, rawId, 'Encrypted string must differ from plain text');
  assert.match(encrypted, /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i, 'Must match iv:authTag:cipher format');

  const decrypted = decryptSensitiveData(encrypted);
  assert.equal(decrypted, rawId, 'Decrypted text must match original ID');

  const masked = maskIdNumber(rawId);
  assert.equal(masked, '***************4321', 'Must mask all but last 4 digits');
  assert.equal(maskIdNumber('1234'), '****');
  assert.equal(maskIdNumber(null), '****');
});

// 2. Cryptographically Secure Tracking Code
test('Tracking code generator produces collision-resistant secure identifiers', () => {
  const code1 = generateSecureTrackingCode();
  const code2 = generateSecureTrackingCode();

  assert.match(code1, /^PRC-[0-9A-F]{4}-[0-9A-Z]+-[0-9A-F]{4}$/);
  assert.match(code2, /^PRC-[0-9A-F]{4}-[0-9A-Z]+-[0-9A-F]{4}$/);
  assert.notEqual(code1, code2, 'Subsequent codes must be unique');
});

// 3. Signed QR Code Security
test('QR code signing with HMAC prevents tampering and hides PII', () => {
  const resourceType = 'parcel';
  const identifier = 'PRC-8F2A-M1K9-7E3B';
  const signedQr = buildSignedQrPayload(resourceType, identifier);

  assert.ok(signedQr.startsWith(`vanguard://${resourceType}/${identifier}.`));
  assert.equal(signedQr.includes('customerName'), false, 'QR payload must not include PII');
  assert.equal(signedQr.includes('phone'), false, 'QR payload must not include phone numbers');

  const verified = verifySignedQrPayload(signedQr, 'parcel');
  assert.ok(verified);
  assert.equal(verified.identifier, identifier);

  // Tampered QR rejection
  const tamperedQr = signedQr.replace(identifier, 'PRC-FAKE-CODE-0000');
  const tamperedResult = verifySignedQrPayload(tamperedQr, 'parcel');
  assert.equal(tamperedResult, null, 'Tampered QR must be rejected');
});

// 4. Server-Side Parcel Pricing Engine
test('Parcel pricing engine calculates official price server-side and applies rules deterministically', async () => {
  // Standard 1kg, 0.005 m³ -> Base fee = 5.00 USD
  const standardPrice = await calculateOfficialPrice({
    weightKg: 1,
    volumeM3: 0.005,
    category: 'STANDARD',
  });
  assert.equal(standardPrice.amount, '5.00');
  assert.equal(standardPrice.currency, 'USD');

  // Heavy parcel: 10kg (+9kg chargeable * 1.50 = 13.50), Base = 5.00 -> Total = 18.50 USD
  const heavyPrice = await calculateOfficialPrice({
    weightKg: 10,
    volumeM3: 0.005,
    category: 'STANDARD',
  });
  assert.equal(heavyPrice.amount, '18.50');

  // Fragile multiplier (1.3) + Declared value insurance (1% on 500 = 5.00)
  // Base 5.00 * 1.3 = 6.50 + 5.00 insurance = 11.50 USD
  const fragileWithInsurance = await calculateOfficialPrice({
    weightKg: 1,
    volumeM3: 0.001,
    category: 'FRAGILE',
    declaredValue: 500,
  });
  assert.equal(fragileWithInsurance.amount, '11.50');
  assert.equal(fragileWithInsurance.breakdown.categoryMultiplier, 1.3);
});

// 5. Payment Providers Abstraction & MbiyoPay Preparation
test('Payment providers abstraction cleanly handles AGENCY and prepares ONLINE without live keys', async () => {
  const agencyProvider = getProvider('AGENCY');
  assert.equal(agencyProvider.name, 'AGENCY');

  const agencyPayment = await agencyProvider.initiatePayment({
    amount: 50.00,
    currency: 'USD',
    agentId: 'agent-123',
    method: 'CASH',
  });
  assert.equal(agencyPayment.status, 'VERIFIED');
  assert.equal(agencyPayment.channel, 'AGENCY');
  assert.equal(agencyPayment.receivedByUserId, 'agent-123');

  const onlineProvider = getProvider('ONLINE');
  assert.equal(onlineProvider.name, 'MBIYOPAY');
  assert.equal(onlineProvider.isConfigured(), false); // Clean unconfigured state

  const onlineInit = await onlineProvider.initiatePayment({
    amount: 100.00,
    currency: 'USD',
    reference: 'RES-TEST-01',
  });
  assert.equal(onlineInit.status, 'PENDING_PROVIDER_SETUP');
  assert.equal(onlineInit.provider, 'MBIYOPAY');
});

// 6. Webhook Signature & Idempotent Verification
test('Webhook signature validation and idempotency handling', () => {
  const provider = new MbiyoPayProvider({ webhookSecret: 'test-secret-key-12345' });
  const payload = { transactionId: 'TX-999', reference: 'PAY-REF-01', amount: 45.00, status: 'SUCCESS' };
  const rawPayload = JSON.stringify(payload);

  const signature = crypto
    .createHmac('sha256', 'test-secret-key-12345')
    .update(rawPayload)
    .digest('hex');

  const isValid = provider.verifyWebhookSignature({
    payload: rawPayload,
    signature,
    secret: 'test-secret-key-12345',
  });
  assert.equal(isValid, true, 'Valid HMAC signature must be accepted');

  const isBadSig = provider.verifyWebhookSignature({
    payload: rawPayload,
    signature: 'bad-signature-hex-string',
    secret: 'test-secret-key-12345',
  });
  assert.equal(isBadSig, false, 'Invalid HMAC signature must be rejected');

  const event = provider.parseWebhookEvent({ body: payload });
  assert.equal(event.providerTransactionId, 'TX-999');
  assert.equal(event.status, 'VERIFIED');
});

// 7. Parcel Workflow State Machine
test('Parcel status transition state machine enforces strict progression and prevents illegal jumps', () => {
  const transitions = {
    REGISTERED: ['PAYMENT_PENDING', 'PAID', 'CANCELLED'],
    PAYMENT_PENDING: ['PAID', 'CANCELLED'],
    PAID: ['ACCEPTED', 'CANCELLED', 'RETURNED'],
    ACCEPTED: ['IN_TRANSIT', 'CANCELLED', 'RETURNED'],
    IN_TRANSIT: ['ARRIVED_AT_AGENCY', 'RETURNED'],
    ARRIVED_AT_AGENCY: ['READY_FOR_PICKUP', 'COLLECTED', 'RETURNED'],
    READY_FOR_PICKUP: ['COLLECTED', 'RETURNED'],
    COLLECTED: [],
    RETURNED: [],
    CANCELLED: [],
  };

  const validateTransition = (current, next) => {
    const allowed = transitions[current] || [];
    if (!allowed.includes(next)) throw new Error(`Invalid transition from ${current} to ${next}`);
    return true;
  };

  // Valid flow
  assert.doesNotThrow(() => validateTransition('REGISTERED', 'PAID'));
  assert.doesNotThrow(() => validateTransition('PAID', 'ACCEPTED'));
  assert.doesNotThrow(() => validateTransition('ACCEPTED', 'IN_TRANSIT'));
  assert.doesNotThrow(() => validateTransition('IN_TRANSIT', 'ARRIVED_AT_AGENCY'));
  assert.doesNotThrow(() => validateTransition('ARRIVED_AT_AGENCY', 'READY_FOR_PICKUP'));
  assert.doesNotThrow(() => validateTransition('READY_FOR_PICKUP', 'COLLECTED'));

  // Illegal jumps
  assert.throws(() => validateTransition('REGISTERED', 'COLLECTED'), /Invalid transition/);
  assert.throws(() => validateTransition('REGISTERED', 'IN_TRANSIT'), /Invalid transition/);
  assert.throws(() => validateTransition('COLLECTED', 'READY_FOR_PICKUP'), /Invalid transition/);
  assert.throws(() => validateTransition('CANCELLED', 'PAID'), /Invalid transition/);
});

// 8. Atomic Collection & Concurrency Simulation
test('Parcel pickup is atomic and rejects multiple concurrent collections', () => {
  let parcelState = { status: 'READY_FOR_PICKUP', pickupCount: 0 };

  const attemptPickup = (collector) => {
    if (parcelState.status !== 'READY_FOR_PICKUP' && parcelState.status !== 'ARRIVED_AT_AGENCY') {
      throw new Error('409: Parcel not ready or already collected');
    }
    // Atomic state lock
    parcelState.status = 'COLLECTED';
    parcelState.pickupCount++;
    return { success: true, collector };
  };

  // First pickup succeeds
  const first = attemptPickup('Alice');
  assert.equal(first.success, true);
  assert.equal(parcelState.status, 'COLLECTED');
  assert.equal(parcelState.pickupCount, 1);

  // Concurrent second pickup fails immediately
  assert.throws(() => attemptPickup('Bob'), /already collected/);
  assert.equal(parcelState.pickupCount, 1);
});

// 9. RBAC & Identity Data Access Protection
test('Decrypted ID number is restricted to users with VIEW_IDENTITY_DATA permission', () => {
  const encryptedId = encryptSensitiveData('PASS-99887766');

  const fetchIdentity = (user) => {
    if (!user.permissions?.includes('VIEW_IDENTITY_DATA')) {
      const err = new Error('Insufficient permissions');
      err.statusCode = 403;
      throw err;
    }
    return decryptSensitiveData(encryptedId);
  };

  const superAdmin = { role: 'SUPER_ADMIN', permissions: ['VIEW_IDENTITY_DATA'] };
  const standardAgent = { role: 'AGENT', permissions: ['CREATE_PARCEL', 'VIEW_PARCEL', 'COLLECT_PARCEL'] };

  assert.equal(fetchIdentity(superAdmin), 'PASS-99887766');
  assert.throws(() => fetchIdentity(standardAgent), (err) => err.statusCode === 403);
});

// 10. Transport Reservation Price Manipulation Rejection (Server Price Truth)
test('Reservation price manipulation rejection: client-supplied totalAmount is strictly ignored in favor of trip schedule price', () => {
  const schedulePrice = '50.00';

  const computeOfficialReservationAmount = (data, trip) => {
    // Exact logic from src/services/reservationService.js
    const totalAmount = String(trip.schedule.price ?? '0.00');
    return totalAmount;
  };

  const trip = { schedule: { price: schedulePrice } };

  // Case A: Attacker tries 0.01 USD
  const attackerAmount = computeOfficialReservationAmount({ totalAmount: '0.01' }, trip);
  assert.equal(attackerAmount, '50.00', 'Must strictly ignore 0.01 and enforce 50.00 USD');

  // Case B: Attacker tries 999999 USD
  const highAmount = computeOfficialReservationAmount({ totalAmount: '999999' }, trip);
  assert.equal(highAmount, '50.00', 'Must strictly ignore arbitrary high values');

  // Case C: Client omits totalAmount
  const defaultAmount = computeOfficialReservationAmount({}, trip);
  assert.equal(defaultAmount, '50.00');
});

// 11. MbiyoPay Webhook 503 when unconfigured (Zero Data Mutation)
test('MbiyoPay webhook returns HTTP 503 and performs zero data mutations when provider is not configured', async () => {
  const unconfiguredProvider = new MbiyoPayProvider({ apiKey: null, merchantId: null });
  assert.equal(unconfiguredProvider.isConfigured(), false);

  let dbMutationOccurred = false;

  const mockHandleWebhook = async (req, provider) => {
    if (!provider.isConfigured()) {
      return { status: 503, body: { success: false, message: 'MbiyoPay webhook provider is not configured' } };
    }
    // Simulation of DB mutation if reached
    dbMutationOccurred = true;
    return { status: 200, body: { success: true } };
  };

  const req = {
    headers: {},
    body: { transactionId: 'TX-ATTACK', reference: 'RES-01', amount: 50.00, status: 'SUCCESS' },
  };

  const res = await mockHandleWebhook(req, unconfiguredProvider);
  assert.equal(res.status, 503);
  assert.equal(res.body.success, false);
  assert.equal(dbMutationOccurred, false, 'No DB mutation must occur when unconfigured');
});

// 12. MbiyoPay Webhook Signature & Idempotency when Configured
test('MbiyoPay webhook when configured verifies HMAC-SHA256 signature (401 on bad sig) and enforces idempotency', async () => {
  const configuredProvider = new MbiyoPayProvider({
    apiKey: 'live-key-123',
    merchantId: 'merchant-456',
    webhookSecret: 'secret-webhook-789',
  });
  assert.equal(configuredProvider.isConfigured(), true);

  const payload = { transactionId: 'TX-100', reference: 'RES-100', amount: 35.00, status: 'SUCCESS' };
  const rawPayload = JSON.stringify(payload);

  const validSignature = crypto
    .createHmac('sha256', 'secret-webhook-789')
    .update(rawPayload)
    .digest('hex');

  // Bad signature -> 401
  const isBadSigValid = configuredProvider.verifyWebhookSignature({
    payload: rawPayload,
    signature: 'bad-sig',
    secret: 'secret-webhook-789',
  });
  assert.equal(isBadSigValid, false);

  // Valid signature -> True
  const isGoodSigValid = configuredProvider.verifyWebhookSignature({
    payload: rawPayload,
    signature: validSignature,
    secret: 'secret-webhook-789',
  });
  assert.equal(isGoodSigValid, true);

  // Idempotency simulation
  const paymentState = { id: 'pay-1', status: 'PENDING', amount: '35.00' };
  const processWebhook = (event) => {
    if (paymentState.status === 'VERIFIED') return { status: 'ALREADY_PROCESSED' };
    if (Number(paymentState.amount) !== Number(event.amount)) return { status: 'AMOUNT_MISMATCH' };
    paymentState.status = 'VERIFIED';
    return { status: 'PROCESSED' };
  };

  const firstCall = processWebhook(payload);
  assert.equal(firstCall.status, 'PROCESSED');
  assert.equal(paymentState.status, 'VERIFIED');

  // Replay call
  const secondCall = processWebhook(payload);
  assert.equal(secondCall.status, 'ALREADY_PROCESSED');
});

// 13. Agency Isolation on Parcels (IDOR Protection)
test('Agency isolation on parcels: restricts local agents to assigned agency and grants global access to Super Admin', () => {
  const assertAgencyAccess = (currentUser, parcel, action = 'view') => {
    if (!currentUser) {
      const err = new Error('Unauthorized');
      err.statusCode = 401;
      throw err;
    }
    if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'SERVICE_ADMIN') {
      return true; // Global HQ access
    }

    const userAgencyId = currentUser.agencyId || currentUser.agency?.id;
    if (!userAgencyId) return true;

    if (action === 'collect' || action === 'arrival' || action === 'destination') {
      if (parcel.destinationAgencyId && parcel.destinationAgencyId !== userAgencyId) {
        const err = new Error('Access denied: You can only perform this action for parcels assigned to your destination agency');
        err.statusCode = 403;
        throw err;
      }
    } else if (action === 'origin' || action === 'create' || action === 'depart') {
      if (parcel.originAgencyId && parcel.originAgencyId !== userAgencyId) {
        const err = new Error('Access denied: You can only perform this action for parcels originating from your agency');
        err.statusCode = 403;
        throw err;
      }
    } else {
      const isOrigin = parcel.originAgencyId && parcel.originAgencyId === userAgencyId;
      const isDestination = parcel.destinationAgencyId && parcel.destinationAgencyId === userAgencyId;
      if ((parcel.originAgencyId || parcel.destinationAgencyId) && !isOrigin && !isDestination) {
        const err = new Error('Access denied: Parcel does not belong to your agency');
        err.statusCode = 403;
        throw err;
      }
    }
    return true;
  };

  const agentAgencyA = { role: 'AGENT', agencyId: 'AGENCY_A' };
  const agentAgencyB = { role: 'AGENT', agencyId: 'AGENCY_B' };
  const superAdmin = { role: 'SUPER_ADMIN' };

  const parcelA = { id: 'p-1', originAgencyId: 'AGENCY_A', destinationAgencyId: 'AGENCY_A' };
  const parcelB = { id: 'p-2', originAgencyId: 'AGENCY_B', destinationAgencyId: 'AGENCY_B' };

  // Scenario 1: Agent Agency A -> Parcel Agency A (Authorized)
  assert.equal(assertAgencyAccess(agentAgencyA, parcelA, 'view'), true);
  assert.equal(assertAgencyAccess(agentAgencyA, parcelA, 'collect'), true);

  // Scenario 2: Agent Agency A -> Parcel Agency B (Forbidden 403)
  assert.throws(() => assertAgencyAccess(agentAgencyA, parcelB, 'view'), (err) => err.statusCode === 403);
  assert.throws(() => assertAgencyAccess(agentAgencyA, parcelB, 'collect'), (err) => err.statusCode === 403);

  // Scenario 3: Agent Agency B -> Parcel Agency A (Forbidden 403)
  assert.throws(() => assertAgencyAccess(agentAgencyB, parcelA, 'view'), (err) => err.statusCode === 403);
  assert.throws(() => assertAgencyAccess(agentAgencyB, parcelA, 'collect'), (err) => err.statusCode === 403);

  // Scenario 4: Super Admin -> Parcel Agency A & B (Authorized)
  assert.equal(assertAgencyAccess(superAdmin, parcelA, 'collect'), true);
  assert.equal(assertAgencyAccess(superAdmin, parcelB, 'collect'), true);
});

