const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');

const SUPPORTED_NETWORKS = new Set(['vodacom', 'airtel', 'orange', 'africell']);

const parseMoney = (value) => {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('A valid amount is required');
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('A positive amount is required');
  return amount;
};

class MbiyoPayProvider extends PaymentProvider {
  constructor({ baseUrl, apiKey, webhookSecret, webhookSignatureEncoding, callbackUrl, timeoutMs = 12000, fetchImpl = global.fetch } = {}) {
    super('MBIYOPAY');
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
    this.webhookSignatureEncoding = String(webhookSignatureEncoding || '').toLowerCase();
    this.callbackUrl = callbackUrl;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  assertConfigured() {
    let parsed;
    try { parsed = new URL(this.baseUrl); } catch { const error = new Error('MbiyoPay base URL is not configured'); error.statusCode = 503; throw error; }
    if (parsed.protocol !== 'https:') { const error = new Error('MbiyoPay requires an HTTPS base URL'); error.statusCode = 503; throw error; }
    if (this.callbackUrl) {
      let callback;
      try { callback = new URL(this.callbackUrl); } catch { const error = new Error('MbiyoPay callback URL is invalid'); error.statusCode = 503; throw error; }
      if (callback.protocol !== 'https:') { const error = new Error('MbiyoPay callback URL must use HTTPS'); error.statusCode = 503; throw error; }
    }
    if (!this.apiKey) { const error = new Error('MbiyoPay API key is not configured'); error.statusCode = 503; throw error; }
    if (typeof this.fetchImpl !== 'function') { const error = new Error('Fetch is unavailable'); error.statusCode = 503; throw error; }
    return parsed.toString().replace(/\/$/, '');
  }

  validatePaymentContext(context = {}) {
    const amount = parseMoney(context.amount);
    const currency = String(context.currency || '').toUpperCase();
    const network = String(context.network || '').trim().toLowerCase();
    const phoneNumber = String(context.phoneNumber || '').replace(/[\s()-]/g, '');
    if (!['USD', 'CDF'].includes(currency)) throw new Error('MbiyoPay only supports USD and CDF for DR Congo');
    if (!SUPPORTED_NETWORKS.has(network)) throw new Error('Unsupported MbiyoPay network for DR Congo');
    if (!/^\+?243\d{9}$/.test(phoneNumber)) throw new Error('A valid DR Congo mobile number is required');
    if (currency === 'USD' && (amount < 0.1 || amount > 2500)) throw new Error('MbiyoPay USD amount is outside DR Congo limits');
    if (currency === 'CDF' && (amount < 40 || amount > 5000000)) throw new Error('MbiyoPay CDF amount is outside DR Congo limits');
    if (!context.reference || String(context.reference).length > 255) throw new Error('A unique internal payment reference is required');
    return { amount, currency, network, phoneNumber, reference: String(context.reference) };
  }

  async request(path, options = {}) {
    const baseUrl = this.assertConfigured();
    const response = await this.fetchImpl(`${baseUrl}${path}`, {
      ...options,
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    let body;
    try { body = await response.json(); } catch { body = null; }
    return { response, body };
  }

  async initiatePayment(context = {}) {
    const { amount, currency, network, phoneNumber, reference } = this.validatePaymentContext(context);

    const { response, body } = await this.request('/api/v1/merchant/payin', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        currency,
        payment_method: 'mobile_money',
        order_id: reference,
        ...(this.callbackUrl ? { callback_url: this.callbackUrl } : {}),
        metadata: { network, phone_number: phoneNumber, country_code: 'CD' },
      }),
    });

    const data = body?.data;
    const transactionId = data?.transaction_id;
    const status = String(data?.status || '').toLowerCase();
    const providerError = !response.ok || body?.status !== 'success' || status === 'failed' || !transactionId;
    if (providerError) {
      const error = new Error(typeof body?.message === 'string' ? body.message : 'MbiyoPay could not initiate the payment');
      error.providerStatus = status || (response.ok ? 'failed' : 'unknown');
      error.providerTransactionId = transactionId || null;
      error.httpStatus = response.status;
      throw error;
    }
    if (status !== 'pending') throw new Error('MbiyoPay returned an unsupported initiation status');
    if (Number(data.amount) !== amount || String(data.currency || '').toUpperCase() !== currency || String(data.order_id) !== reference) {
      throw new Error('MbiyoPay initiation response does not match the payment request');
    }

    return {
      providerTransactionId: String(transactionId),
      providerReference: String(data.order_id),
      status: 'PENDING',
      amount,
      currency,
      checkoutUrl: typeof data.redirect_url === 'string' ? data.redirect_url : null,
      instructions: typeof data.instructions === 'string' ? data.instructions : null,
      authMode: typeof data.auth_mode === 'string' ? data.auth_mode : null,
    };
  }

  async verifyPayment({ providerTransactionId, reference } = {}) {
    if (!providerTransactionId) throw new Error('MbiyoPay transaction ID is required for verification');
    const { response, body } = await this.request(`/api/v1/merchant/transactions/${encodeURIComponent(providerTransactionId)}`);
    const data = body?.data?.transaction || body?.data || body?.transaction || body;
    if (!response.ok || body?.status === 'error' || !data || typeof data.status !== 'string') {
      const error = new Error('MbiyoPay transaction verification is unavailable');
      error.httpStatus = response.status;
      throw error;
    }
    const orderId = data.order_id ?? data.orderId;
    return {
      providerTransactionId: String(data.transaction_id ?? data.reference ?? providerTransactionId),
      reference: orderId == null ? null : String(orderId),
      status: String(data.status).toLowerCase(),
      amount: Number(data.amount),
      currency: String(data.currency || '').toUpperCase(),
      paidAt: data.updated_at ? new Date(data.updated_at) : undefined,
      rawResponse: data,
      expectedReference: reference == null ? null : String(reference),
    };
  }

  verifyWebhookSignature({ payload, signature, secret = this.webhookSecret } = {}) {
    if (!Buffer.isBuffer(payload) || !signature || !secret || this.webhookSignatureEncoding !== 'hex') return false;
    // MbiyoPay documents HMAC-SHA256 but does not specify the digest encoding.
    // Hex is enabled only after the merchant explicitly confirms it from their provider setup.
    if (!/^[a-f\d]{64}$/i.test(String(signature).trim())) return false;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest();
    const provided = Buffer.from(String(signature).trim(), 'hex');
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  }

  parseWebhookEvent(req) {
    if (!Buffer.isBuffer(req?.body)) return null;
    let rawData;
    try { rawData = JSON.parse(req.body.toString('utf8')); } catch { return null; }
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) return null;
    const event = {
      providerTransactionId: typeof rawData.transaction_id === 'string' ? rawData.transaction_id : null,
      providerReference: typeof rawData.order_id === 'string' ? rawData.order_id : null,
      amount: Number(rawData.amount),
      currency: typeof rawData.currency === 'string' ? rawData.currency.toUpperCase() : null,
      status: typeof rawData.status === 'string' ? rawData.status.toLowerCase() : null,
      type: typeof rawData.type === 'string' ? rawData.type.toLowerCase() : null,
      rawData,
    };
    if (!event.providerTransactionId || !event.providerReference || !Number.isFinite(event.amount) || !event.currency || !event.status) return null;
    return event;
  }
}

module.exports = MbiyoPayProvider;
