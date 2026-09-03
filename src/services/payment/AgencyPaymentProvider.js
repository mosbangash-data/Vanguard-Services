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
  async initiatePayment(paymentContext) {
    const { amount, currency, reference, agentId, method } = paymentContext;
    const agencyReference = reference || `AG-PAY-${Date.now()}-${crypto.randomInt(1000, 9999)}`;

    return {
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

