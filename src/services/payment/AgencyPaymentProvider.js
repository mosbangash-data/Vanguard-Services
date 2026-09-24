const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');

/**
 * Agency Payment Provider - Handles in-person physical desk/counter payments.
 */
class AgencyPaymentProvider extends PaymentProvider {
  constructor() {
    super('AGENCY');
  }

  /**
   * Record a physical agency payment.
   */
  initiatePayment(paymentContext) {
    const { amount, currency, reference, agentId, method } = paymentContext || {};
    const agencyReference = reference || `AG-PAY-${Date.now()}-${crypto.randomInt(1000, 9999)}`;

    const result = {
      provider: this.name,
      channel: 'AGENCY',
      providerTransactionId: agencyReference,
      status: 'VERIFIED',
      amount,
      currency: currency || 'USD',
      method: method || 'CASH',
      receivedByUserId: agentId,
      receivedAt: new Date(),
    };

    const promise = Promise.resolve(result);
    Object.assign(promise, result);
    return promise;
  }

  async verifyPayment(verificationContext) {
    return {
      provider: this.name,
      status: 'VERIFIED',
      providerTransactionId: verificationContext.providerTransactionId,
    };
  }

  verifyWebhookSignature() {
    return false;
  }

  parseWebhookEvent() {
    return null;
  }
}

module.exports = AgencyPaymentProvider;

