const PaymentProvider = require('./PaymentProvider');
const AgencyPaymentProvider = require('./AgencyPaymentProvider');

const agencyPaymentProvider = new AgencyPaymentProvider();

const getProvider = () => agencyPaymentProvider;

module.exports = {
  PaymentProvider,
  AgencyPaymentProvider,
  agencyPaymentProvider,
  getProvider,
};

