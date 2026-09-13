const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');

class MbiyoPayProvider extends PaymentProvider {
  constructor(config = {}) {
    super('MBIYOPAY');
    this.apiKey = config.apiKey || process.env.MBIYOPAY_API_KEY || null;
    this.merchantId = config.merchantId || process.env.MBIYOPAY_MERCHANT_ID || null;
    this.webhookSecret = config.webhookSecret || process.env.MBIYOPAY_WEBHOOK_SECRET || null;
    this.baseUrl = (config.baseUrl || process.env.MBIYOPAY_BASE_URL || '').replace(/\/$/, '');
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

  _sanitizeResponse(data) {
    if (!data || typeof data !== 'object') return data;
    const sanitized = Array.isArray(data) ? [...data] : { ...data };
    const sensitiveKeys = ['apikey', 'api_key', 'secret', 'webhooksecret', 'token', 'authorization', 'password'];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this._sanitizeResponse(sanitized[key]);
      }
    }
    return sanitized;
  }

  async _fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`MbiyoPay gateway request timed out after ${timeoutMs / 1000}s`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
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
        providerTransactionId: null,
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
      callback_url: this.getCallbackUrl() || undefined,
      metadata: {
        network: metadata.network || metadata.network_name || 'Vodacom',
        phone_number: metadata.phone_number || customerPhone || metadata.phoneNumber || '',
        country_code: metadata.country_code || metadata.countryCode || 'CD',
      },
      description: description || `Reservation ${normalizedReference}`,
    };

    try {
      const response = await this._fetchWithTimeout(`${this.baseUrl}/api/v1/merchant/payin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }, 15000);

      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }

      const sanitizedData = this._sanitizeResponse(data);

      if (!response.ok) {
        return {
          provider: this.name,
          isConfigured: true,
          providerTransactionId: null,
          providerReference: normalizedReference,
          status: 'FAILED',
          message: sanitizedData?.message || `MbiyoPay payment initiation failed with HTTP ${response.status}.`,
          rawResponse: sanitizedData,
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

      if (!providerTransactionId) {
        return {
          provider: this.name,
          isConfigured: true,
          providerTransactionId: null,
          providerReference: normalizedReference,
          status: 'FAILED',
          message: 'MbiyoPay did not return a valid transaction_id.',
          rawResponse: sanitizedData,
        };
      }

      return {
        provider: this.name,
        isConfigured: true,
        providerTransactionId,
        providerReference: data?.order_id || data?.orderId || data?.reference || normalizedReference,
        status: 'PENDING',
        amount: Number(amount),
        currency: String(currency).toUpperCase(),
        rawResponse: sanitizedData,
      };
    } catch (error) {
      return {
        provider: this.name,
        isConfigured: true,
        providerTransactionId: null,
        providerReference: normalizedReference,
        status: 'FAILED',
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

    const statusUrl = process.env.MBIYOPAY_TRANSACTION_STATUS_URL
      || `${this.baseUrl}/api/v1/merchant/payin/${encodeURIComponent(providerTransactionId)}`;

    try {
      const response = await this._fetchWithTimeout(statusUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }, 15000);

      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }

      const sanitizedData = this._sanitizeResponse(data);

      if (!response.ok) {
        return {
          provider: this.name,
          isConfigured: true,
          status: 'PENDING',
          providerTransactionId,
          reference,
          rawResponse: sanitizedData,
        };
      }

      const statusValue = String(data?.status || data?.data?.status || data?.transaction?.status || 'PENDING').toUpperCase();
      const normalizedStatus = statusValue === 'SUCCESS' || statusValue === 'SUCCESSFUL' || statusValue === 'PAID' || statusValue === 'COMPLETED' || statusValue === 'VERIFIED'
        ? 'VERIFIED'
        : statusValue === 'FAILED' || statusValue === 'REJECTED' || statusValue === 'CANCELLED' || statusValue === 'CANCELED'
          ? 'FAILED'
          : 'PENDING';

      return {
        provider: this.name,
        isConfigured: true,
        status: normalizedStatus,
        amount: Number(data?.amount ?? data?.data?.amount ?? data?.transaction?.amount ?? 0),
        currency: String(data?.currency || data?.data?.currency || data?.transaction?.currency || 'USD').toUpperCase(),
        providerTransactionId,
        reference,
        rawResponse: sanitizedData,
      };
    } catch (error) {
      return {
        provider: this.name,
        isConfigured: true,
        status: 'PENDING',
        providerTransactionId,
        reference,
        message: error.message || 'MbiyoPay verification error',
      };
    }
  }

  verifyWebhookSignature({ payload, signature, secret }) {
    const signingSecret = secret || this.webhookSecret;
    if (!signingSecret || !signature || !payload) return false;

    try {
      const rawPayload = Buffer.isBuffer(payload)
        ? payload
        : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload), 'utf8');
      const expectedSignature = crypto
        .createHmac('sha256', signingSecret)
        .update(rawPayload)
        .digest('hex');

      const providedSignature = String(signature).trim().replace(/^sha256=/i, '').toLowerCase();
      const referenceSignature = expectedSignature.toLowerCase();
      if (!providedSignature || providedSignature.length !== referenceSignature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(providedSignature, 'hex'),
        Buffer.from(referenceSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  parseWebhookEvent(req) {
    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.isBuffer(req.body) ? req.body : null;
    const parsedBody = rawBody ? (() => {
      try {
        return JSON.parse(rawBody.toString('utf8'));
      } catch {
        return {};
      }
    })() : (req.body && typeof req.body === 'object' ? req.body : {});

    const body = parsedBody || {};
    const payload = body.data && typeof body.data === 'object' ? body.data : body;
    const eventType = payload.event || payload.type || body.event || body.type || 'PAYMENT_UPDATED';
    const providerTransactionId = payload.transaction_id || payload.transactionId || payload.id || body.transaction_id || body.transactionId || body.id || null;
    const providerReference = payload.order_id || payload.orderId || payload.reference || payload.merchantReference || body.order_id || body.orderId || body.reference || null;
    const amountValue = payload.amount ?? body.amount ?? null;
    const currencyValue = payload.currency || body.currency || 'USD';
    const rawStatus = String(payload.status || body.status || 'PENDING').toLowerCase();
    const normalizedStatus = rawStatus === 'successful' || rawStatus === 'success' || rawStatus === 'paid' || rawStatus === 'verified'
      ? 'VERIFIED'
      : rawStatus === 'failed' || rawStatus === 'rejected' || rawStatus === 'cancelled' || rawStatus === 'canceled'
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
