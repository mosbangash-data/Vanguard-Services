const prisma = require('../config/prisma');

const listVehiclePaymentsByReservationId = async ({ reservationId, skip = 0, take = 20, orderBy = { createdAt: 'desc' } } = {}) => {
  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where: { vehicleReservationId: reservationId },
      skip,
      take,
      orderBy,
      include: { validatedBy: true },
    }),
    prisma.payment.count({ where: { vehicleReservationId: reservationId } }),
  ]);

  return { items, total };
};

const getVehiclePaymentById = async (id) => prisma.payment.findUnique({
  where: { id },
  include: {
    vehicleReservation: { include: { vehicle: true } },
    validatedBy: true,
  },
});

const createVehiclePayment = async (data) => prisma.payment.create({ data });

const updateVehiclePayment = async (id, data) => prisma.payment.update({
  where: { id },
  data,
});

module.exports = {
  listVehiclePaymentsByReservationId,
  getVehiclePaymentById,
  createVehiclePayment,
  updateVehiclePayment,
};
