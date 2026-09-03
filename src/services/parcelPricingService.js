let prisma;
const getPrisma = () => {
  if (!prisma) {
    try {
      prisma = require('../config/prisma');
    } catch (e) {
      prisma = null;
    }
  }
  return prisma;
};

const DEFAULT_BASE_PRICE = 5.00; // 5 USD base
const DEFAULT_PRICE_PER_KG = 1.50; // 1.50 USD / kg above 1 kg
const DEFAULT_PRICE_PER_M3 = 50.00; // 50 USD / m³ above 0.01 m³

const CATEGORY_COEFFICIENTS = {
  STANDARD: 1.0,
  DOCUMENT: 0.8,
  FRAGILE: 1.3,
  VALUABLES: 1.5,
  PERISHABLE: 1.4,
  ELECTRONICS: 1.25,
};

const calculateOfficialPrice = async ({
  originCity,
  destinationCity,
  weightKg = 0,
  volumeM3 = 0,
  category = 'STANDARD',
  declaredValue = 0,
  departmentId,
} = {}) => {
  const weight = Math.max(Number(weightKg) || 0, 0);
  const volume = Math.max(Number(volumeM3) || 0, 0);
  const value = Math.max(Number(declaredValue) || 0, 0);
  const normalizedCategory = String(category || 'STANDARD').trim().toUpperCase();
  const coefficient = CATEGORY_COEFFICIENTS[normalizedCategory] || 1.0;

  // Base fee
  let baseFee = DEFAULT_BASE_PRICE;

  // Weight fee: first 1kg included in base fee, then 1.50/kg
  const chargeableWeight = Math.max(weight - 1, 0);
  const weightFee = chargeableWeight * DEFAULT_PRICE_PER_KG;

  // Volume fee: first 0.01 m³ included in base, then 50/m³
  const chargeableVolume = Math.max(volume - 0.01, 0);
  const volumeFee = chargeableVolume * DEFAULT_PRICE_PER_M3;

  // Category markup on physical handling
  const physicalFee = (baseFee + weightFee + volumeFee) * coefficient;

  // Optional insurance fee: 1% of declared value
  const insuranceFee = value > 0 ? value * 0.01 : 0;

  const total = physicalFee + insuranceFee;
  const roundedAmount = Math.round(total * 100) / 100;

  let currency = 'USD';
  if (departmentId) {
    try {
      const db = getPrisma();
      if (db?.serviceSettings) {
        const settings = await db.serviceSettings.findUnique({ where: { departmentId } });
        if (settings?.currency) currency = settings.currency;
      }
    } catch (e) {
      // Fallback to USD if DB query unavailable
    }
  }

  return {
    amount: roundedAmount.toFixed(2),
    currency,
    breakdown: {
      baseFee: baseFee.toFixed(2),
      weightFee: weightFee.toFixed(2),
      volumeFee: volumeFee.toFixed(2),
      categoryMultiplier: coefficient,
      insuranceFee: insuranceFee.toFixed(2),
      total: roundedAmount.toFixed(2),
    },
  };
};

module.exports = {
  calculateOfficialPrice,
  CATEGORY_COEFFICIENTS,
};

