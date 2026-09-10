const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');

class MbiyoPayProvider extends PaymentProvider {
  constructor(config = {}) {
    super('MBIYOPAY');
    this.apiKey = config.apiKey || process.env.MBIYOPAY_API_KEY || null;
    this.merchantId = config.merchantId || process.env.MBIYOPAY_MERCHANT_ID || null;
    this.webhookSecret = config.webhookSecret || process.env.MBIYOPAY_WEBHOOK_SECRET || null;
    this.baseUrl = (config.baseUrl || process.env.MBIYOPAY_BASE_URL || 'https://sandbox.mbiyopay.com').replace(/\/$/, '');
    this.callbackUrl = config.callbackUrl || process.env.MBIYOPAY_CALLBACK_URL || null;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.webhookSecret && this.baseUrl);
  }

  getCallbackUrl() {
    if (this.callbackUrl) return this.callbackUrl;
    const publicBaseUrl = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/$/, '');
    if (publicBaseUrl) return `${publicBaseUrl}/api/webhooks/mbiyopay`;
    return null;
  }

  async initiatePayment(paymentContext) {
    const {
      amount,
      currency = 'USD',
      reference,
      orderId,
      description,
      customerPhone,
      metadata = {},
    } = paymentContext;

    const normalizedReference = reference || orderId || `RES-${Date.now()}`;
    if (!this.apiKey || !this.baseUrl) {
      return {
        provider: this.name,
        isConfigured: false,
        providerTransactionId: `MBIYO-PENDING-${normalizedReference}`,
        providerReference: normalizedReference,
        status: 'PENDING_PROVIDER_SETUP',
        message: 'MbiyoPay is not configured for sandbox execution yet.',
        reference: normalizedReference,
        amount,
        currency,
      };
    }

    const payload = {
      amount: Number(amount),
      currency: String(currency).toUpperCase(),
      payment_method: 'mobile_money',
      order_id: orderId || normalizedReference,
      callback_url: this.getCallbackUrl() || `${process.env.PUBLIC_BASE_URL || 'https://localhost:3000'}/api/webhooks/mbiyopay`,
      metadata: {
        network: metadata.network || metadata.network_name || 'MTN',
        phone_number: metadata.phone_number || customerPhone || metadata.phoneNumber || '',
        country_code: metadata.country_code || metadata.countryCode || 'CD',
      },
      description: description || `Reservation ${normalizedReference}`,
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/merchant/payin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) {
        return {
          provider: this.name,
          isConfigured: true,
          providerTransactionId: `MBIYO-PENDING-${normalizedReference}`,
          providerReference: normalizedReference,
          status: 'PENDING_PROVIDER_SETUP',
          message: data?.message || 'MbiyoPay payment initiation failed.',
          rawResponse: data,
        };
      }

      const providerTransactionId =
        data?.transaction_id ||
        data?.transactionId ||
        data?.id ||
        data?.data?.transaction_id ||
        data?.data?.id ||
        data?.payment?.transaction_id ||
        null;

      return {
        provider: this.name,
        isConfigured: true,
        providerTransactionId,
        providerReference: data?.order_id || data?.orderId || data?.reference || normalizedReference,
        status: 'PENDING',
        amount: Number(amount),
        currency: String(currency).toUpperCase(),
        rawResponse: data,
      };
    } catch (error) {
      return {
        provider: this.name,
        isConfigured: true,
        providerTransactionId: `MBIYO-PENDING-${normalizedReference}`,
        providerReference: normalizedReference,
        status: 'PENDING_PROVIDER_SETUP',
        message: error.message || 'MbiyoPay initiation error',
      };
    }
  }

  async verifyPayment(verificationContext) {
    const { providerTransactionId, reference } = verificationContext;
    if (!providerTransactionId || !this.apiKey || !this.baseUrl) {
      return {
        provider: this.name,
        isConfigured: Boolean(this.apiKey && this.baseUrl),
        status: 'PENDING',
        providerTransactionId,
        reference,
      };
    }

    const urls = [
      `${this.baseUrl}/api/v1/merchant/payments/${encodeURIComponent(providerTransactionId)}`,
      `${this.baseUrl}/api/v1/merchant/transactions/${encodeURIComponent(providerTransactionId)}`,
      `${this.baseUrl}/api/v1/merchant/payin/${encodeURIComponent(providerTransactionId)}`,
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) continue;
        const data = await response.json();
        const statusValue = data?.status || data?.data?.status || data?.transaction?.status || 'PENDING';
        const normalizedStatus = statusValue === 'SUCCESS' || statusValue === 'PAID' || statusValue === 'COMPLETED' || statusValue === 'VERIFIED' ? 'VERIFIED' : statusValue === 'FAILED' || statusValue === 'REJECTED' ? 'REJECTED' : 'PENDING';

        return {
          provider: this.name,
          isConfigured: true,
          status: normalizedStatus,
          amount: Number(data?.amount ?? data?.data?.amount ?? 0),
          currency: String(data?.currency || data?.data?.currency || 'USD').toUpperCase(),
          providerTransactionId,
          reference,
          rawResponse: data,
        };
      } catch (error) {
        // Continue across URL candidates; the next endpoint may answer successfully.
      }
    }

    return {
      provider: this.name,
      isConfigured: true,
      status: 'PENDING',
      providerTransactionId,
      reference,
    };
  }

  verifyWebhookSignature({ payload, signature, secret }) {
    const signingSecret = secret || this.webhookSecret;
    if (!signingSecret || !signature || !payload) return false;

    try {
      const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', signingSecret)
        .update(rawPayload)
        .digest('hex');

      const providedSignature = String(signature).trim().replace(/^sha256=/i, '');
      if (providedSignature.length !== expectedSignature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(providedSignature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      );
    } catch (error) {
      return false;
    }
  }

  parseWebhookEvent(req) {
    const body = req.body || {};
    const payload = body.data && typeof body.data === 'object' ? body.data : body;
    const eventType = payload.event || payload.type || body.event || body.type || 'PAYMENT_UPDATED';
    const providerTransactionId = payload.transaction_id || payload.transactionId || payload.id || body.transaction_id || body.transactionId || body.id || null;
    const providerReference = payload.order_id || payload.orderId || payload.reference || payload.merchantReference || body.order_id || body.orderId || body.reference || null;
    const amountValue = payload.amount ?? body.amount ?? null;
    const currencyValue = payload.currency || body.currency || 'USD';
    const rawStatus = payload.status || body.status || 'PENDING';
    const normalizedStatus = rawStatus === 'SUCCESS' || rawStatus === 'PAID' || rawStatus === 'COMPLETED' || rawStatus === 'VERIFIED'
      ? 'VERIFIED'
      : rawStatus === 'FAILED' || rawStatus === 'REJECTED' || rawStatus === 'CANCELLED'
        ? 'REJECTED'
        : 'PENDING';

    return {
      eventType,
      providerTransactionId,
      providerReference,
      amount: amountValue == null ? null : Number(amountValue),
      currency: String(currencyValue).toUpperCase(),
      status: normalizedStatus,
      rawData: body,
    };
  }
}

module.exports = MbiyoPayProvider;
