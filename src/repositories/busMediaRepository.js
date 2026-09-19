const prisma = require('../config/prisma');

const listMediaByBusId = async (busId, client = prisma) => client.busMedia.findMany({
  where: { busId },
  orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }, { id: 'asc' }],
  include: { media: true },
});

const getBusMediaById = async (id, client = prisma) => client.busMedia.findUnique({
  where: { id },
  include: { media: true, bus: true },
});

const createBusMedia = async ({ busId, mediaId, caption, order, isPrimary }, client = prisma) => client.busMedia.create({
  data: {
    bus: { connect: { id: busId } },
    caption,
    order,
    isPrimary,
    media: { connect: { id: mediaId } },
  },
  include: { media: true },
});

const updateBusMedia = async (id, data, client = prisma) => client.busMedia.update({
  where: { id },
  data,
  include: { media: true },
});

const deleteBusMedia = async (id, client = prisma) => client.busMedia.delete({
  where: { id },
});

const unsetPrimaryForBus = async (busId, client = prisma) => client.busMedia.updateMany({
  where: { busId, isPrimary: true },
  data: { isPrimary: false },
});

module.exports = {
  listMediaByBusId,
  getBusMediaById,
  createBusMedia,
  updateBusMedia,
  deleteBusMedia,
  unsetPrimaryForBus,
};
