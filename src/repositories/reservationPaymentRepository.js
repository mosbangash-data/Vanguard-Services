const prisma = require('../config/prisma');

const listReservationPaymentsByReservationId = async ({ reservationId, skip = 0, take = 20, orderBy = { createdAt: 'desc' } } = {}) => {
  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where: { reservationId },
      skip,
      take,
      orderBy,
    }),
    prisma.payment.count({ where: { reservationId } }),
  ]);

  return { items, total };
};

const getReservationPaymentById = async (id) => prisma.payment.findUnique({
  where: { id },
  include: { reservation: true },
});

const listCoachReservationPayments = async ({ departmentId, status, skip = 0, take = 50 }) => {
  const where = {
    reservation: { trip: { schedule: { departmentId } } },
    ...(status ? { status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { reservation: { include: { trip: { include: { schedule: { include: { route: true } } } } } } },
    }),
    prisma.payment.count({ where }),
  ]);
  return { items, total };
};

const createReservationPayment = async (data) => prisma.payment.create({ data });

const updateReservationPayment = async (id, data) => prisma.payment.update({ where: { id }, data });

module.exports = {
  listReservationPaymentsByReservationId,
  getReservationPaymentById,
  listCoachReservationPayments,
  createReservationPayment,
  updateReservationPayment,
};
