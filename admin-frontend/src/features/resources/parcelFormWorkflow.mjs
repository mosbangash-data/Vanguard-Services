export function buildParcelCreatePayload(formData, quote) {
  const pricingBasis = formData.pricingBasis
  return {
    ...formData,
    amount: quote.amount,
    currency: quote.currency,
    paymentMethod: 'CASH',
    weightKg: pricingBasis === 'WEIGHT' ? Number(formData.weightKg) : 0,
    volumeM3: pricingBasis === 'VOLUME' ? Number(formData.volumeM3) : 0,
    cashCollected: formData.paymentTiming === 'AT_DEPOSIT' && formData.cashCollected === true,
  }
}
