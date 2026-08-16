const prisma = require('../config/prisma');

const listVehicles = async ({ where = {}, skip = 0, take = 20, orderBy = { createdAt: 'desc' } } = {}) => {
  const [items, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      skip,
      take,
      orderBy,
      include: { media: { include: { media: true }, orderBy: { order: 'asc' } } },
    }),
    prisma.vehicle.count({ where }),
  ]);

  return { items, total };
};

const getVehicleById = async (id) => prisma.vehicle.findUnique({
  where: { id },
  include: { media: { include: { media: true }, orderBy: { order: 'asc' } } },
});

const createVehicle = async (data) => prisma.vehicle.create({ data });

const updateVehicle = async (id, data) => prisma.vehicle.update({ where: { id }, data });

const deleteVehicle = async (id) => prisma.vehicle.delete({ where: { id } });

const countVehicleInquiries = async (vehicleId) => prisma.vehicleInquiry.count({ where: { vehicleId } });

const countVehicleReservations = async (vehicleId) => prisma.vehicleReservation.count({ where: { vehicleId } });

module.exports = { listVehicles, getVehicleById, createVehicle, updateVehicle, deleteVehicle, countVehicleInquiries, countVehicleReservations };
