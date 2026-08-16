const prisma = require('../config/prisma');

const listVehicleInquiries = async ({ where = {}, skip = 0, take = 20, orderBy = { createdAt: 'desc' } } = {}) => {
  const [items, total] = await Promise.all([
    prisma.vehicleInquiry.findMany({ where, skip, take, orderBy, include: { vehicle: true, assignedTo: true, createdBy: true } }),
    prisma.vehicleInquiry.count({ where }),
  ]);

  return { items, total };
};

const getVehicleInquiryById = async (id) => prisma.vehicleInquiry.findUnique({ where: { id }, include: { vehicle: true, assignedTo: true, createdBy: true } });

const createVehicleInquiry = async (data) => prisma.vehicleInquiry.create({ data, include: { vehicle: true, assignedTo: true, createdBy: true } });

const updateVehicleInquiry = async (id, data) => prisma.vehicleInquiry.update({ where: { id }, data, include: { vehicle: true, assignedTo: true, createdBy: true } });

module.exports = {
  listVehicleInquiries,
  getVehicleInquiryById,
  createVehicleInquiry,
  updateVehicleInquiry,
};