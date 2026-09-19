const prisma = require('../config/prisma');

const listMediaByVehicleId = async (vehicleId, client = prisma) => client.vehicleMedia.findMany({
  where: { vehicleId },
  orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }, { id: 'asc' }],
  include: { media: true },
});

const getVehicleMediaById = async (id, client = prisma) => client.vehicleMedia.findUnique({
  where: { id },
  include: { media: true, vehicle: true },
});

const createVehicleMedia = async ({ vehicleId, mediaId, caption, order, isPrimary }, client = prisma) => client.vehicleMedia.create({
  data: {
    vehicle: { connect: { id: vehicleId } },
    caption,
    order,
    isPrimary,
    media: { connect: { id: mediaId } },
  },
  include: { media: true },
});

const updateVehicleMedia = async (id, data, client = prisma) => client.vehicleMedia.update({
  where: { id },
  data,
  include: { media: true },
});

const deleteVehicleMedia = async (id, client = prisma) => client.vehicleMedia.delete({
  where: { id },
});

const unsetPrimaryForVehicle = async (vehicleId, client = prisma) => client.vehicleMedia.updateMany({
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
