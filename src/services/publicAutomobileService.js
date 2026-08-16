const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const createPublicVehicleInquiry = async (data) => {
  const { vehicleId, customerName, customerEmail, customerPhone, inquiryType, contactPreference, message } = data;

  if (!vehicleId || !customerName || !message) {
    throw new AppError('vehicleId, customerName and message are required', 400);
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new AppError('Vehicle not found', 404);
  if (vehicle.status !== 'AVAILABLE') throw new AppError('Vehicle not found', 404);

  const validTypes = ['INFORMATION', 'PRICE_REQUEST', 'CONTACT'];
  const normalizedType = validTypes.includes(inquiryType) ? inquiryType : 'INFORMATION';

  // Le backend fixe les valeurs internes — le client ne peut pas les choisir
  const inquiry = await prisma.vehicleInquiry.create({
    data: {
      vehicleId,
      customerName: normalizeString(customerName),
      customerEmail: customerEmail ? normalizeString(customerEmail) : null,
      customerPhone: customerPhone ? normalizeString(customerPhone) : null,
      inquiryType: normalizedType,
      contactPreference: contactPreference ? normalizeString(contactPreference) : null,
      message: normalizeString(message),
      status: 'NEW',
      assignedToUserId: null,
      createdByUserId: null,
    },
  });

  return {
    inquiry: {
      id: inquiry.id,
      status: inquiry.status,
      createdAt: inquiry.createdAt,
    },
  };
};

module.exports = {
  createPublicVehicleInquiry,
};