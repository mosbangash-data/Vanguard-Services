const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { getScopedDepartmentId } = require('./departmentAccessService');

const VALIDATED_PAYMENT_STATUSES = ['VERIFIED', 'COMPLETED'];

const getDashboard = async (user) => {
  if (!user) throw new AppError('Unauthorized', 401);
  if (user.role !== 'SUPER_ADMIN' && user.department?.type !== 'AUTO_SALES') throw new AppError('Access denied', 403);

  const permissions = new Set(user.permissions || []);
  if (!['VIEW_VEHICLE', 'VIEW_VEHICLE_INQUIRY', 'VIEW_RESERVATION'].some((permission) => permissions.has(permission))) {
    throw new AppError('Insufficient permissions', 403);
  }

  const departmentId = await getScopedDepartmentId(user, null, 'AUTO_SALES')
    || (await prisma.department.findUnique({ where: { type: 'AUTO_SALES' }, select: { id: true } }))?.id;
  if (!departmentId) throw new AppError('AutoSales department not found', 404);

  const isAgent = user.role === 'AGENT';
  const vehicleWhere = { departmentId, isTemplate: false };
  const inquiryWhere = { vehicle: { is: { departmentId, isTemplate: false } }, ...(isAgent ? { assignedToUserId: user.id } : {}) };
  const reservationWhere = { vehicle: { is: { departmentId, isTemplate: false } }, ...(isAgent ? { createdByUserId: user.id } : {}) };
  const paymentWhere = { vehicleReservation: { is: reservationWhere } };
  const canVehicles = permissions.has('VIEW_VEHICLE');
  const canInquiries = permissions.has('VIEW_VEHICLE_INQUIRY');
  const canReservations = permissions.has('VIEW_RESERVATION');
  const canPayments = canReservations;

  const [settings, vehicleGroups, recentVehicles, inquiryGroups, recentInquiries, reservationGroups,
    paymentGroups, recentPayments, financialReservations, pendingReservations, recentReservations] = await Promise.all([
    prisma.serviceSettings.findUnique({ where: { departmentId }, select: { currency: true } }),
    canVehicles ? prisma.vehicle.groupBy({ by: ['status'], where: vehicleWhere, _count: { _all: true } }) : [],
    canVehicles ? prisma.vehicle.findMany({ where: vehicleWhere, orderBy: { createdAt: 'desc' }, take: 6,
      select: { id: true, brand: true, model: true, year: true, price: true, currency: true, status: true, createdAt: true } }) : [],
    canInquiries ? prisma.vehicleInquiry.groupBy({ by: ['status'], where: inquiryWhere, _count: { _all: true } }) : [],
    canInquiries ? prisma.vehicleInquiry.findMany({ where: inquiryWhere, orderBy: { createdAt: 'desc' }, take: 6,
      select: { id: true, customerName: true, status: true, createdAt: true, assignedToUserId: true, vehicle: { select: { id: true, brand: true, model: true } } } }) : [],
    canReservations ? prisma.vehicleReservation.groupBy({ by: ['status'], where: reservationWhere, _count: { _all: true } }) : [],
    canPayments ? prisma.payment.groupBy({ by: ['status', 'currency'], where: paymentWhere, _count: { _all: true }, _sum: { amount: true } }) : [],
    canPayments ? prisma.payment.findMany({ where: paymentWhere, orderBy: { createdAt: 'desc' }, take: 6,
      select: { id: true, amount: true, currency: true, method: true, status: true, createdAt: true, reference: true,
        vehicleReservation: { select: { id: true, reservationCode: true, customerName: true, vehicle: { select: { id: true, brand: true, model: true } } } } } }) : [],
    canReservations ? prisma.vehicleReservation.findMany({ where: { ...reservationWhere, status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] } },
      select: { id: true, status: true, reservationAmount: true, vehicle: { select: { currency: true } }, payments: { where: { status: { in: VALIDATED_PAYMENT_STATUSES } }, select: { amount: true, currency: true, status: true } } } }) : [],
    canReservations ? prisma.vehicleReservation.findMany({ where: { ...reservationWhere, status: { in: ['PENDING', 'CONFIRMED'] }, expirationDate: { gte: new Date(), lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) } },
      orderBy: { expirationDate: 'asc' }, take: 10, select: { id: true, reservationCode: true, customerName: true, expirationDate: true, status: true } }) : [],
    canReservations ? prisma.vehicleReservation.findMany({ where: reservationWhere, orderBy: { createdAt: 'desc' }, take: 6,
      select: { id: true, reservationCode: true, customerName: true, status: true, reservationAmount: true, createdAt: true, vehicle: { select: { id: true, brand: true, model: true, currency: true } } } }) : [],
  ]);

  const statusCounts = (groups) => Object.fromEntries(groups.map((row) => [row.status, row._count._all]));
  const stockByStatus = statusCounts(vehicleGroups);
  const inquiriesByStatus = statusCounts(inquiryGroups);
  const reservationsByStatus = statusCounts(reservationGroups);
  const paymentsByStatus = {};
  const collectedByCurrency = {};
  for (const row of paymentGroups) {
    paymentsByStatus[row.status] = (paymentsByStatus[row.status] || 0) + row._count._all;
    if (VALIDATED_PAYMENT_STATUSES.includes(row.status)) {
      const currency = row.currency || 'USD';
      collectedByCurrency[currency] = (collectedByCurrency[currency] || 0) + Number(row._sum.amount || 0);
    }
  }

  const revenueByCurrency = {};
  const salesOutstandingByCurrency = {};
  const outstandingByCurrency = {};
  let saleCount = 0;
  for (const reservation of financialReservations) {
    const currency = reservation.vehicle.currency || 'USD';
    const amount = Number(reservation.reservationAmount || 0);
    const paid = reservation.payments.filter((payment) => (payment.currency || 'USD') === currency)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const remaining = Math.max(amount - paid, 0);
    outstandingByCurrency[currency] = (outstandingByCurrency[currency] || 0) + remaining;
    if (reservation.status === 'COMPLETED') {
      saleCount += 1;
      revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + amount;
      salesOutstandingByCurrency[currency] = (salesOutstandingByCurrency[currency] || 0) + remaining;
    }
  }

  const actionsRequired = [];
  if (canInquiries && inquiriesByStatus.NEW) actionsRequired.push({ type: 'NEW_INQUIRIES', label: 'Nouvelles demandes à traiter', count: inquiriesByStatus.NEW, path: '/automobile/inquiries', permission: 'VIEW_VEHICLE_INQUIRY' });
  if (canReservations && reservationsByStatus.PENDING) actionsRequired.push({ type: 'PENDING_RESERVATIONS', label: 'Réservations à confirmer', count: reservationsByStatus.PENDING, path: '/automobile/reservations', permission: 'VIEW_RESERVATION' });
  const pendingPayments = paymentsByStatus.PENDING || 0;
  if (canPayments && pendingPayments) actionsRequired.push({ type: 'PENDING_PAYMENTS', label: 'Paiements à valider', count: pendingPayments, path: '/automobile/payments', permission: 'VIEW_RESERVATION' });
  if (canReservations && pendingReservations.length) actionsRequired.push({ type: 'EXPIRING_RESERVATIONS', label: 'Réservations proches de l’expiration', count: pendingReservations.length, path: '/automobile/reservations', permission: 'VIEW_RESERVATION', items: pendingReservations });

  return {
    scope: { department: 'AUTO_SALES', departmentId, currency: settings?.currency || 'USD', agentId: isAgent ? user.id : null },
    stock: canVehicles ? { total: Object.values(stockByStatus).reduce((sum, count) => sum + count, 0), byStatus: stockByStatus, recent: recentVehicles } : null,
    inquiries: canInquiries ? { total: Object.values(inquiriesByStatus).reduce((sum, count) => sum + count, 0), byStatus: inquiriesByStatus, recent: recentInquiries } : null,
    reservations: canReservations ? { total: Object.values(reservationsByStatus).reduce((sum, count) => sum + count, 0), byStatus: reservationsByStatus, recent: recentReservations, expiringSoon: pendingReservations } : null,
    payments: canPayments ? { byStatus: paymentsByStatus, pendingValidation: pendingPayments, verified: paymentsByStatus.VERIFIED || 0, rejected: paymentsByStatus.REJECTED || 0, collectedByCurrency, outstandingByCurrency, recent: recentPayments } : null,
    sales: canReservations ? { count: saleCount, revenueByCurrency, outstandingByCurrency: salesOutstandingByCurrency, collectedByCurrency } : null,
    actionsRequired,
  };
};

module.exports = { getDashboard };
