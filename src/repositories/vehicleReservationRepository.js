const prisma = require('../config/prisma');

const listVehicleReservations = async ({ where = {}, skip = 0, take = 20, orderBy = { createdAt: 'desc' } } = {}) => {
  const [items, total] = await Promise.all([
    prisma.vehicleReservation.findMany({ where, skip, take, orderBy, include: { vehicle: true, createdBy: true, cancellations: true, payments: true } }),
    prisma.vehicleReservation.count({ where }),
  ]);

  return { items, total };
};

const getVehicleReservationById = async (id) => prisma.vehicleReservation.findUnique({ where: { id }, include: { vehicle: true, createdBy: true, cancellations: true, payments: true } });

const findActiveReservationForVehicle = async (vehicleId) => prisma.vehicleReservation.findFirst({
  where: {
    vehicleId,
    status: { in: ['PENDING', 'CONFIRMED'] },
  },
});

const createVehicleReservation = async (data) => prisma.vehicleReservation.create({ data, include: { vehicle: true, createdBy: true, cancellations: true, payments: true } });

const updateVehicleReservation = async (id, data) => prisma.vehicleReservation.update({ where: { id }, data, include: { vehicle: true, createdBy: true, cancellations: true, payments: true } });

const createVehicleReservationCancellation = async (data) => prisma.vehicleReservationCancellation.create({ data, include: { vehicleReservation: true, cancelledBy: true } });

module.exports = {
  listVehicleReservations,
  getVehicleReservationById,
  findActiveReservationForVehicle,
  createVehicleReservation,
  updateVehicleReservation,
  createVehicleReservationCancellation,
};
