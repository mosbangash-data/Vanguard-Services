const PaymentProvider = require('./PaymentProvider');
const MbiyoPayProvider = require('./MbiyoPayProvider');
const AgencyPaymentProvider = require('./AgencyPaymentProvider');

const mbiyoPayProvider = new MbiyoPayProvider();
const agencyPaymentProvider = new AgencyPaymentProvider();

const getProvider = (channelOrProvider) => {
  const normalized = String(channelOrProvider || '').toUpperCase();
  if (normalized === 'MBIYOPAY' || normalized === 'ONLINE') {
    return mbiyoPayProvider;
  }
  return agencyPaymentProvider;
};

module.exports = {
  PaymentProvider,
  MbiyoPayProvider,
  AgencyPaymentProvider,
  mbiyoPayProvider,
  agencyPaymentProvider,
  getProvider,
};

