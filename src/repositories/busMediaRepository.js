const prisma = require('../config/prisma');

const listMediaByBusId = async (busId) => prisma.busMedia.findMany({
  where: { busId },
  orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }],
  include: { media: true },
});

const getBusMediaById = async (id) => prisma.busMedia.findUnique({
  where: { id },
  include: { media: true, bus: true },
});

const createBusMedia = async ({ busId, caption, order, isPrimary, mediaData }) => prisma.busMedia.create({
  data: {
    bus: { connect: { id: busId } },
    caption,
    order,
    isPrimary,
    media: {
      create: {
        ...mediaData,
        entityType: 'bus',
        entityId: busId,
      },
    },
  },
  include: { media: true },
});

const updateBusMedia = async (id, data) => prisma.busMedia.update({
  where: { id },
  data,
  include: { media: true },
});

const deleteBusMedia = async (id) => prisma.busMedia.delete({
  where: { id },
});

const unsetPrimaryForBus = async (busId) => prisma.busMedia.updateMany({
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
