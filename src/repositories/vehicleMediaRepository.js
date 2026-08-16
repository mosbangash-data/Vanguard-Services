const prisma = require('../config/prisma');

const listMediaByVehicleId = async (vehicleId) => prisma.vehicleMedia.findMany({
  where: { vehicleId },
  orderBy: { order: 'asc' },
  include: { media: true },
});

const getVehicleMediaById = async (id) => prisma.vehicleMedia.findUnique({
  where: { id },
  include: { media: true, vehicle: true },
});

const createVehicleMedia = async ({ vehicleId, caption, order, isPrimary, mediaData }) => prisma.vehicleMedia.create({
  data: {
    vehicle: { connect: { id: vehicleId } },
    caption,
    order,
    isPrimary,
    media: {
      create: {
        ...mediaData,
        entityType: 'vehicle',
        entityId: vehicleId,
      },
    },
  },
  include: { media: true },
});

const updateVehicleMedia = async (id, data) => prisma.vehicleMedia.update({
  where: { id },
  data,
  include: { media: true },
});

const deleteVehicleMedia = async (id) => prisma.vehicleMedia.delete({
  where: { id },
});

const unsetPrimaryForVehicle = async (vehicleId) => prisma.vehicleMedia.updateMany({
  where: { vehicleId, isPrimary: true },
  data: { isPrimary: false },
});

module.exports = {
  listMediaByVehicleId,
  getVehicleMediaById,
  createVehicleMedia,
  updateVehicleMedia,
  deleteVehicleMedia,
  unsetPrimaryForVehicle,
};
