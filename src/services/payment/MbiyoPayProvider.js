const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');

/**
 * MbiyoPay Payment Provider - Preparation and Contract Interface.
 * Ready to receive real MbiyoPay credentials and endpoints in a future step.
 */
class MbiyoPayProvider extends PaymentProvider {
  constructor(config = {}) {
    super('MBIYOPAY');
    this.apiKey = config.apiKey || process.env.MBIYOPAY_API_KEY || null;
    this.merchantId = config.merchantId || process.env.MBIYOPAY_MERCHANT_ID || null;
    this.webhookSecret = config.webhookSecret || process.env.MBIYOPAY_WEBHOOK_SECRET || null;
    this.baseUrl = config.baseUrl || process.env.MBIYOPAY_BASE_URL || 'https://api.mbiyopay.com/v1';
  }

  isConfigured() {
    return Boolean(this.apiKey && this.merchantId);
  }

  /**
   * Prepare/initiate an online checkout session with MbiyoPay.
   */
  async initiatePayment(paymentContext) {
    const { amount, currency, reference, description, customerEmail, customerPhone, metadata } = paymentContext;

    if (!this.isConfigured()) {
      return {
        provider: this.name,
        isConfigured: false,
        providerTransactionId: `MBIYO-PENDING-${reference}`,
        status: 'PENDING_PROVIDER_SETUP',
        message: 'MbiyoPay payment provider is prepared and awaiting production API credentials.',
        reference,
        amount,
        currency,
      };
    }

    // Future implementation will perform the HTTP POST to MbiyoPay checkout API
    throw new Error('MbiyoPay live integration endpoint is not active yet');
  }

  /**
   * Verify an existing transaction status with MbiyoPay.
   */
  async verifyPayment(verificationContext) {
    const { providerTransactionId, reference } = verificationContext;

    if (!this.isConfigured()) {
      return {
        provider: this.name,
        isConfigured: false,
        status: 'PENDING_CONFIG',
        providerTransactionId,
        reference,
      };
    }

    throw new Error('MbiyoPay live verification endpoint is not active yet');
  }

  /**
   * Verify authenticity of incoming webhook from MbiyoPay using HMAC-SHA256 signature.
   */
  verifyWebhookSignature({ payload, signature, secret }) {
    const signingSecret = secret || this.webhookSecret;
    if (!signingSecret || !signature || !payload) return false;

    try {
      const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', signingSecret)
        .update(rawPayload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(String(signature), 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      );
    } catch (err) {
      return false;
    }
  }

  /**
   * Parse a raw webhook request into standardized transaction metadata.
   */
  parseWebhookEvent(req) {
    const body = req.body || {};
    return {
      eventType: body.event || body.type || 'PAYMENT_UPDATED',
      providerTransactionId: body.transactionId || body.id || null,
      providerReference: body.reference || body.merchantReference || null,
      amount: body.amount ? Number(body.amount) : null,
      currency: body.currency || 'USD',
      status: body.status === 'SUCCESS' || body.status === 'COMPLETED' ? 'VERIFIED' : 'PENDING',
      rawData: body,
    };
  }
}

module.exports = MbiyoPayProvider;
