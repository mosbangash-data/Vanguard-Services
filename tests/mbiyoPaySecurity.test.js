const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
process.env.JWT_SECRET ||= 'test-jwt-secret-that-is-at-least-thirty-two-characters';
process.env.SESSION_SECRET ||= 'test-session-secret-that-is-at-least-thirty-two-characters';
process.env.TICKET_QR_SECRET ||= 'test-ticket-qr-secret-that-is-at-least-thirty-two-characters';
process.env.DATABASE_URL ||= 'postgresql://vanguard:test@127.0.0.1:5432/vanguard_test';
const prisma = require('../src/config/prisma');
const MbiyoPayProvider = require('../src/services/payment/MbiyoPayProvider');

test('MbiyoPay Payin validates amount and request response before returning a pending transaction', async () => {
  let request;
  const provider = new MbiyoPayProvider({
    baseUrl: 'https://sandbox.example.test', apiKey: 'test-key', webhookSecret: 'test-secret',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ status: 'success', data: {
        transaction_id: 'mbiyo-123', order_id: 'payment-internal-1', amount: 12.5, currency: 'USD', status: 'pending',
      } }) };
    },
  });
  const result = await provider.initiatePayment({ amount: '12.50', currency: 'USD', reference: 'payment-internal-1', network: 'vodacom', phoneNumber: '+243812345678' });
  assert.equal(result.providerTransactionId, 'mbiyo-123');
  assert.equal(request.url, 'https://sandbox.example.test/api/v1/merchant/payin');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(request.options.body), {
    amount: 12.5, currency: 'USD', payment_method: 'mobile_money', order_id: 'payment-internal-1',
    metadata: { network: 'vodacom', phone_number: '+243812345678', country_code: 'CD' },
  });
});

test('MbiyoPay rejects HTTP-200 business failures, mismatched amounts, and invalid webhook signatures', async () => {
  const failedProvider = new MbiyoPayProvider({
    baseUrl: 'https://sandbox.example.test', apiKey: 'test-key',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ status: 'error', data: { status: 'failed' } }) }),
  });
  await assert.rejects(failedProvider.initiatePayment({ amount: 1, currency: 'USD', reference: 'p', network: 'airtel', phoneNumber: '243812345678' }));
  const mismatchProvider = new MbiyoPayProvider({
    baseUrl: 'https://sandbox.example.test', apiKey: 'test-key',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ status: 'success', data: { transaction_id: 'x', order_id: 'p', amount: 2, currency: 'USD', status: 'pending' } }) }),
  });
  await assert.rejects(mismatchProvider.initiatePayment({ amount: 1, currency: 'USD', reference: 'p', network: 'airtel', phoneNumber: '243812345678' }));
  const provider = new MbiyoPayProvider({ webhookSecret: 'secret', webhookSignatureEncoding: 'hex' });
  const payload = Buffer.from('{"status":"successful"}');
  const digest = crypto.createHmac('sha256', 'secret').update(payload).digest('hex');
  assert.equal(provider.verifyWebhookSignature({ payload, signature: digest }), true);
  assert.equal(provider.verifyWebhookSignature({ payload, signature: 'invalid' }), false);
  assert.equal(provider.verifyWebhookSignature({ payload: Buffer.from('{}'), signature: digest }), false);
});

test('parcel Mobile Money initiation rejects anonymous, missing, and cross-agency parcel requests', async () => {
  const service = require('../src/services/mbiyoPayService');
  const oldFindParcel = prisma.parcel.findUnique;
  const oldFindDepartment = prisma.department.findUnique;
  try {
    await assert.rejects(service.initiateParcelPayment('parcel-x', {}, null), { statusCode: 401 });

    prisma.parcel.findUnique = async () => null;
    await assert.rejects(service.initiateParcelPayment('missing', {}, {
      role: 'AGENT', agencyId: 'agency-a', department: { type: 'VANGUARD_COACH' }, permissions: ['VERIFY_PARCEL_PAYMENT'],
    }), { statusCode: 404 });

    prisma.parcel.findUnique = async () => ({
      id: 'parcel-b', paymentTiming: 'AT_DEPOSIT', status: 'PAYMENT_PENDING',
      originAgencyId: 'agency-b', destinationAgencyId: 'agency-c', payments: [],
    });
    prisma.department.findUnique = async () => ({ id: 'coach-dept' });
    await assert.rejects(service.initiateParcelPayment('parcel-b', {}, {
      role: 'AGENT', agencyId: 'agency-a', department: { type: 'VANGUARD_COACH' }, permissions: ['VERIFY_PARCEL_PAYMENT'],
    }), { statusCode: 403 });
    await assert.rejects(service.initiateParcelPayment('parcel-b', {}, {
      role: 'MANAGER', agencyId: 'agency-a', department: { type: 'VANGUARD_COACH' }, permissions: ['VERIFY_PARCEL_PAYMENT'],
    }), { statusCode: 403 });
    await assert.rejects(service.initiateParcelPayment('parcel-b', {}, {
      role: 'SERVICE_ADMIN', department: { type: 'CONSTRUCTION' }, permissions: ['VERIFY_PARCEL_PAYMENT'],
    }), { statusCode: 403 });
  } finally {
    prisma.parcel.findUnique = oldFindParcel;
    prisma.department.findUnique = oldFindDepartment;
  }
});

test('Agent can initiate Mobile Money only for an existing parcel payment in the assigned agency', async () => {
  const service = require('../src/services/mbiyoPayService');
  const { mbiyoPayProvider } = require('../src/services/payment');
  const oldFindParcel = prisma.parcel.findUnique;
  const oldFindDepartment = prisma.department.findUnique;
  const oldUpdatePayment = prisma.payment.updateMany;
  const oldAssertConfigured = mbiyoPayProvider.assertConfigured;
  const oldValidateContext = mbiyoPayProvider.validatePaymentContext;
  const oldInitiate = mbiyoPayProvider.initiatePayment;
  const user = { role: 'AGENT', agencyId: 'agency-a', department: { type: 'VANGUARD_COACH' }, permissions: ['VERIFY_PARCEL_PAYMENT'] };
  try {
    prisma.parcel.findUnique = async () => ({
      id: 'parcel-a', paymentTiming: 'AT_DEPOSIT', status: 'PAYMENT_PENDING', originAgencyId: 'agency-a', destinationAgencyId: 'agency-b',
      amount: '12.50', currency: 'USD', payments: [{ id: 'payment-a', parcelId: 'parcel-a', agencyId: 'agency-a', amount: '12.50', currency: 'USD', method: 'MOBILE_MONEY', provider: 'MBIYOPAY', status: 'PENDING' }],
    });
    prisma.department.findUnique = async () => ({ id: 'coach-dept', type: 'VANGUARD_COACH' });
    prisma.payment.updateMany = async () => ({ count: 1 });
    mbiyoPayProvider.assertConfigured = () => 'https://sandbox.example.test';
    mbiyoPayProvider.validatePaymentContext = () => ({ amount: 12.5, currency: 'USD' });
    mbiyoPayProvider.initiatePayment = async () => ({ providerTransactionId: 'provider-tx-1', providerReference: 'payment-a', checkoutUrl: 'https://checkout.example.test' });

    const result = await service.initiateParcelPayment('parcel-a', { network: 'vodacom', phoneNumber: '+243812345678' }, user);
    assert.equal(result.status, 'PROCESSING');
    assert.equal(result.paymentId, 'payment-a');
    await assert.rejects(service.initiateParcelPayment('parcel-a', {}, { ...user, permissions: [] }), { statusCode: 403 });
  } finally {
    prisma.parcel.findUnique = oldFindParcel;
    prisma.department.findUnique = oldFindDepartment;
    prisma.payment.updateMany = oldUpdatePayment;
    mbiyoPayProvider.assertConfigured = oldAssertConfigured;
    mbiyoPayProvider.validatePaymentContext = oldValidateContext;
    mbiyoPayProvider.initiatePayment = oldInitiate;
  }
});

test('public reservation Mobile Money uses only the phone verified against the existing booking', async () => {
  const service = require('../src/services/mbiyoPayService');
  const { mbiyoPayProvider } = require('../src/services/payment');
  const oldFindReservation = prisma.reservation.findUnique;
  const oldFindDepartment = prisma.department.findUnique;
  const oldUpdatePayment = prisma.payment.updateMany;
  const oldAssertConfigured = mbiyoPayProvider.assertConfigured;
  const oldValidateContext = mbiyoPayProvider.validatePaymentContext;
  const oldInitiate = mbiyoPayProvider.initiatePayment;
  let receivedContext;
  try {
    prisma.reservation.findUnique = async () => ({
      id: 'reservation-a', reservationCode: 'RSV-A', customerPhone: '+243812345678', totalAmount: '8.00', status: 'PENDING',
      trip: { schedule: { departmentId: 'coach-dept' } },
      payments: [{ id: 'payment-a', reservationId: 'reservation-a', amount: '8.00', currency: 'USD', method: 'MOBILE_MONEY', provider: 'MBIYOPAY', status: 'PENDING' }],
    });
    prisma.department.findUnique = async () => ({ id: 'coach-dept', type: 'VANGUARD_COACH' });
    prisma.payment.updateMany = async () => ({ count: 1 });
    mbiyoPayProvider.assertConfigured = () => 'https://sandbox.example.test';
    mbiyoPayProvider.validatePaymentContext = () => ({ amount: 8, currency: 'USD' });
    mbiyoPayProvider.initiatePayment = async (context) => {
      receivedContext = context;
      return { providerTransactionId: 'provider-reservation-tx', providerReference: 'payment-a' };
    };

    await service.initiatePublicReservationPayment('RSV-A', {
      customerPhone: '+243812345678', phoneNumber: '+243899999999', network: 'orange',
    });
    assert.equal(receivedContext.phoneNumber, '+243812345678');
    assert.equal(receivedContext.reference, 'payment-a');
  } finally {
    prisma.reservation.findUnique = oldFindReservation;
    prisma.department.findUnique = oldFindDepartment;
    prisma.payment.updateMany = oldUpdatePayment;
    mbiyoPayProvider.assertConfigured = oldAssertConfigured;
    mbiyoPayProvider.validatePaymentContext = oldValidateContext;
    mbiyoPayProvider.initiatePayment = oldInitiate;
  }
});

test('public parcel creation is explicitly forbidden while existing parcel tracking remains read-only', async () => {
  const express = require('express');
  const publicRoutes = require('../src/routes/public');
  const { errorHandler } = require('../src/middleware/errorHandler');
  const oldFindParcel = prisma.parcel.findUnique;
  const app = express();
  app.use(express.json());
  app.use('/api/public', publicRoutes);
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    const createResponse = await fetch(`http://127.0.0.1:${address.port}/api/public/parcels`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senderName: 'Client public' }),
    });
    assert.equal(createResponse.status, 403);

    const noPaymentRoute = await fetch(`http://127.0.0.1:${address.port}/api/public/parcels/PKG-EXISTING/mobile-money`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ network: 'vodacom', phoneNumber: '+243812345678' }),
    });
    assert.equal(noPaymentRoute.status, 404);

    prisma.parcel.findUnique = async () => ({
      trackingCode: 'PKG-EXISTING', senderName: 'Sender', recipientName: 'Recipient', originCity: 'Kinshasa', destinationCity: 'Matadi',
      originAgency: null, destinationAgency: null, category: 'STANDARD', weightKg: '1.00', volumeM3: '0.01', amount: '10.00', currency: 'USD',
      paymentTiming: 'AT_DEPOSIT', status: 'IN_TRANSIT', createdAt: new Date(), statusHistory: [],
    });
    const trackingResponse = await fetch(`http://127.0.0.1:${address.port}/api/public/parcels/PKG-EXISTING`);
    assert.equal(trackingResponse.status, 200);
    const trackingData = await trackingResponse.json();
    assert.equal(trackingData.data.parcel.trackingCode, 'PKG-EXISTING');
  } finally {
    prisma.parcel.findUnique = oldFindParcel;
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
