const PaymentProvider = require('./PaymentProvider');
const AgencyPaymentProvider = require('./AgencyPaymentProvider');
const MbiyoPayProvider = require('./MbiyoPayProvider');
const env = require('../../config/env');

const agencyPaymentProvider = new AgencyPaymentProvider();
const mbiyoPayProvider = new MbiyoPayProvider({
  baseUrl: env.mbiyoPayBaseUrl,
  apiKey: env.mbiyoPayApiKey,
  webhookSecret: env.mbiyoPayWebhookSecret,
  webhookSignatureEncoding: env.mbiyoPayWebhookSignatureEncoding,
  callbackUrl: env.mbiyoPayCallbackUrl,
  timeoutMs: env.mbiyoPayTimeoutMs,
});

const getProvider = (provider = 'AGENCY') => {
  if (String(provider).toUpperCase() === 'AGENCY') return agencyPaymentProvider;
  if (String(provider).toUpperCase() === 'MBIYOPAY') return mbiyoPayProvider;
  throw new Error(`Unsupported payment provider: ${provider}`);
};

module.exports = {
  PaymentProvider,
  AgencyPaymentProvider,
  MbiyoPayProvider,
  agencyPaymentProvider,
  mbiyoPayProvider,
  getProvider,
};

