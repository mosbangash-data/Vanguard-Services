export function buildParcelCreatePayload(formData, quote) {
  const pricingBasis = formData.pricingBasis
  return {
    ...formData,
    amount: quote.amount,
    currency: quote.currency,
    paymentMethod: String(formData.paymentMethod || 'CASH').toUpperCase(),
    weightKg: pricingBasis === 'WEIGHT' ? Number(formData.weightKg) : 0,
    volumeM3: pricingBasis === 'VOLUME' ? Number(formData.volumeM3) : 0,
    cashCollected: formData.paymentMethod !== 'MOBILE_MONEY' && formData.paymentTiming === 'AT_DEPOSIT' && formData.cashCollected === true,
  }
}
