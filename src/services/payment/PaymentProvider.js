/**
 * Abstract base class defining the payment gateway provider contract.
 */
class PaymentProvider {
  constructor(name) {
    if (new.target === PaymentProvider) {
      throw new TypeError('Cannot construct PaymentProvider instances directly');
    }
    this.name = name;
  }

  /**
   * Initiate a payment with the provider.
   * @param {Object} paymentContext - { amount, currency, reference, description, customerEmail, customerPhone, metadata }
   * @returns {Promise<{ providerTransactionId: string, checkoutUrl?: string, status: string, rawResponse: any }>}
   */
  async initiatePayment(paymentContext) {
    throw new Error('initiatePayment() must be implemented by payment provider subclass');
  }

  /**
   * Verify an existing transaction status with the provider.
   * @param {Object} verificationContext - { providerTransactionId, reference }
   * @returns {Promise<{ status: string, amount: number, currency: string, paidAt?: Date, rawResponse: any }>}
   */
  async verifyPayment(verificationContext) {
    throw new Error('verifyPayment() must be implemented by payment provider subclass');
  }

  /**
   * Verify the authenticity of an incoming webhook event.
   * @param {Object} options - { payload, signature, headers, secret }
   * @returns {boolean}
   */
  verifyWebhookSignature(options) {
    throw new Error('verifyWebhookSignature() must be implemented by payment provider subclass');
  }

  /**
   * Parse a raw webhook request into a standardized event object.
   * @param {Object} req - Express request object
   * @returns {Object} { eventType, providerTransactionId, providerReference, amount, currency, status, rawData }
   */
  parseWebhookEvent(req) {
    throw new Error('parseWebhookEvent() must be implemented by payment provider subclass');
  }
}

module.exports = PaymentProvider;
