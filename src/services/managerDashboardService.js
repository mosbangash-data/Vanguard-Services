const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { requireCoachOperational, getUserAgencyId } = require('./departmentAccessService');

const PAID = ['VERIFIED', 'COMPLETED'];
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date) => new Date(startOfDay(date).getTime() + 86400000);
const asNumber = (value) => Number(value || 0);

const getManagerDashboard = async (user) => {
  requireCoachOperational(user);
  if (user.role !== 'MANAGER') throw new AppError('Access denied', 403);
  const departmentId = user.departmentId || user.department?.id;
  if (!departmentId || user.department?.type !== 'VANGUARD_COACH') throw new AppError('Access denied', 403);
  const agencyId = getUserAgencyId(user);
  const permissions = new Set(user.permissions || []);
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = endOfDay(now);
  const can = (permission) => permissions.has(permission);
  if (agencyId) {
    const assignedAgency = await prisma.agency.findFirst({ where: { id: agencyId, departmentId }, select: { id: true } });
    if (!assignedAgency) throw new AppError('Manager agency is outside the department', 403);
  }
  const tripScope = { schedule: { departmentId, ...(agencyId ? { agencyId } : {}) } };
  const operationalTripScope = { schedule: { ...tripScope.schedule, status: 'ACTIVE', route: { status: 'ACTIVE' }, bus: { status: 'ACTIVE' } } };
  const reservationScope = { trip: { schedule: { departmentId, ...(agencyId ? { agencyId } : {}) } }, ...(agencyId ? { OR: [{ agencyId }, { trip: { schedule: { agencyId } } }] } : {}) };
  const parcelScope = agencyId ? { OR: [{ originAgencyId: agencyId }, { destinationAgencyId: agencyId }] } : { OR: [{ originAgency: { departmentId } }, { destinationAgency: { departmentId } }] };
  const paymentAgency = agencyId ? { OR: [{ agencyId }, { reservation: { agencyId } }, { reservation: { trip: { schedule: { agencyId } } } }, { parcel: { OR: [{ originAgencyId: agencyId }, { destinationAgencyId: agencyId }] } }] } : {};
  const revenuePaymentScope = { AND: [paymentAgency, { OR: [{ reservation: { is: reservationScope } }, ...(can('VIEW_PARCEL') ? [{ parcel: { is: parcelScope } }] : [])] }] };
  const [department, agencies, todayTrips, upcomingTrips, cancelledTrips, completedTrips, todayReservations, pendingReservations, confirmedReservations, cancelledReservations, passengers, todayPassengers, pendingPayments, pendingAmountRows, paidPayments, paidToday, paymentBreakdown, parcelCounts, pendingParcelPayments, pendingParcelAmountRows, agentGroups, reservations, payments, parcelAlerts] = await Promise.all([
    prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true, type: true } }),
    prisma.agency.findMany({ where: { departmentId, ...(agencyId ? { id: agencyId } : {}) }, select: { id: true, name: true, code: true } }),
    can('VIEW_TRIP') ? prisma.trip.findMany({ where: { ...operationalTripScope, departureAt: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } }, orderBy: { departureAt: 'asc' }, take: 30, include: { schedule: { include: { route: true, bus: true, agency: true } } } }) : [],
    can('VIEW_TRIP') ? prisma.trip.findMany({ where: { ...operationalTripScope, departureAt: { gte: tomorrow }, status: 'SCHEDULED' }, orderBy: { departureAt: 'asc' }, take: 10, include: { schedule: { include: { route: true, bus: true, agency: true } } } }) : [],
    can('VIEW_TRIP') ? prisma.trip.count({ where: { ...tripScope, status: 'CANCELLED', departureAt: { gte: today, lt: tomorrow } } }) : 0,
    can('VIEW_TRIP') ? prisma.trip.count({ where: { ...tripScope, status: 'COMPLETED', departureAt: { gte: today, lt: tomorrow } } }) : 0,
    can('VIEW_RESERVATION') ? prisma.reservation.count({ where: { ...reservationScope, createdAt: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } } }) : 0,
    can('VIEW_RESERVATION') ? prisma.reservation.count({ where: { ...reservationScope, status: 'PENDING' } }) : 0,
    can('VIEW_RESERVATION') ? prisma.reservation.count({ where: { ...reservationScope, status: 'CONFIRMED' } }) : 0,
    can('VIEW_RESERVATION') ? prisma.reservation.count({ where: { ...reservationScope, status: 'CANCELLED' } }) : 0,
    can('VIEW_RESERVATION') ? prisma.reservation.count({ where: { ...reservationScope, status: { in: ['CONFIRMED', 'COMPLETED'] } } }) : 0,
    can('VIEW_RESERVATION') ? prisma.reservation.count({ where: { ...reservationScope, status: { in: ['CONFIRMED', 'COMPLETED'] }, trip: { schedule: { departmentId, ...(agencyId ? { agencyId } : {}) }, departureAt: { gte: today, lt: tomorrow } } } }) : 0,
    can('VIEW_PAYMENT') ? prisma.payment.count({ where: { reservation: { is: reservationScope }, ...paymentAgency, status: 'PENDING' } }) : 0,
    can('VIEW_PAYMENT') ? prisma.payment.groupBy({ by: ['currency'], where: { reservation: { is: reservationScope }, ...paymentAgency, status: 'PENDING' }, _sum: { amount: true } }) : [],
    can('VIEW_PAYMENT') ? prisma.payment.groupBy({ by: ['currency'], where: { ...revenuePaymentScope, status: { in: PAID } }, _sum: { amount: true } }) : [],
    can('VIEW_PAYMENT') ? prisma.payment.groupBy({ by: ['currency'], where: { ...revenuePaymentScope, status: { in: PAID }, validatedAt: { gte: today, lt: tomorrow } }, _sum: { amount: true } }) : [],
    can('VIEW_PAYMENT') ? prisma.payment.groupBy({ by: ['channel', 'method', 'status'], where: revenuePaymentScope, _count: { _all: true } }) : [],
    can('VIEW_PARCEL') ? Promise.all(['REGISTERED', 'PAYMENT_PENDING', 'ACCEPTED', 'IN_TRANSIT', 'ARRIVED_AT_AGENCY', 'READY_FOR_PICKUP', 'COLLECTED', 'RETURNED'].map((status) => prisma.parcel.count({ where: { ...parcelScope, status } }))) : Array(8).fill(0),
    can('VIEW_PARCEL_PAYMENT') ? prisma.payment.count({ where: { parcel: { is: parcelScope }, status: 'PENDING' } }) : 0,
    can('VIEW_PARCEL_PAYMENT') ? prisma.payment.groupBy({ by: ['currency'], where: { parcel: { is: parcelScope }, status: 'PENDING' }, _sum: { amount: true } }) : [],
    can('VIEW_USER') ? prisma.user.groupBy({ by: ['status'], where: { departmentId, ...(agencyId ? { agencyId } : {}), role: { name: 'AGENT' } }, _count: { _all: true } }) : [],
    can('VIEW_RESERVATION') ? prisma.reservation.findMany({ where: reservationScope, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, reservationCode: true, customerName: true, customerPhone: true, seatNumber: true, totalAmount: true, status: true, createdAt: true, agency: { select: { name: true } }, trip: { select: { departureAt: true, schedule: { select: { route: { select: { departureCity: true, arrivalCity: true } } } } } }, payments: { select: { status: true } } } }) : [],
    can('VIEW_PAYMENT') ? prisma.payment.findMany({ where: revenuePaymentScope, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, reference: true, amount: true, currency: true, channel: true, method: true, status: true, createdAt: true, agency: { select: { name: true } }, validatedBy: { select: { firstName: true, lastName: true } }, reservation: { select: { reservationCode: true, customerName: true } }, parcel: { select: { trackingCode: true, recipientName: true } } } }) : [],
    can('VIEW_PARCEL') ? prisma.parcel.findMany({ where: { ...parcelScope, status: { in: ['PAYMENT_PENDING', 'ARRIVED_AT_AGENCY', 'READY_FOR_PICKUP'] } }, orderBy: { updatedAt: 'desc' }, take: 10, select: { id: true, trackingCode: true, recipientName: true, status: true, updatedAt: true, originAgency: { select: { name: true } }, destinationAgency: { select: { name: true } } } }) : [],
  ]);
  if (!department) throw new AppError('Department not found', 404);
  const tripIds = [...new Set([...todayTrips, ...upcomingTrips].map(({ id }) => id))];
  const reservedGroups = tripIds.length && can('VIEW_RESERVATION') ? await prisma.reservation.groupBy({ by: ['tripId'], where: { ...reservationScope, tripId: { in: tripIds }, status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] } }, _count: { _all: true } }) : [];
  const reservedByTrip = Object.fromEntries(reservedGroups.map(({ tripId, _count }) => [tripId, _count._all]));
  const enrichTrip = (trip) => {
    const capacity = trip.schedule.bus.seats;
    const reservedSeats = reservedByTrip[trip.id] || 0;
    return { id: trip.id, departureAt: trip.departureAt, status: trip.status, route: `${trip.schedule.route.departureCity} – ${trip.schedule.route.arrivalCity}`, bus: trip.schedule.bus.plateNumber, capacity, reservedSeats, availableSeats: Math.max(capacity - reservedSeats, 0), occupancyRate: capacity ? Math.round(100 * reservedSeats / capacity) : 0, agency: trip.schedule.agency?.name || '—' };
  };
  const toCurrencyTotals = (groups) => groups.reduce((totals, row) => { const currency = row.currency || 'USD'; totals[currency] = (totals[currency] || 0) + asNumber(row._sum?.amount); return totals; }, {});
  const revenue = toCurrencyTotals(paidPayments);
  const todayRevenue = toCurrencyTotals(paidToday);
  const pendingPaymentAmount = [...pendingAmountRows, ...pendingParcelAmountRows].reduce((totals, row) => { const currency = row.currency || 'USD'; totals[currency] = (totals[currency] || 0) + asNumber(row._sum?.amount); return totals; }, {});
  const paymentSummary = paymentBreakdown.reduce((summary, row) => {
    const count = row._count?._all || 0;
    summary.byChannel[row.channel] = (summary.byChannel[row.channel] || 0) + count;
    summary.byStatus[row.status] = (summary.byStatus[row.status] || 0) + count;
    summary.byMethod[row.method] = (summary.byMethod[row.method] || 0) + count;
    return summary;
  }, { byChannel: {}, byStatus: {}, byMethod: {} });
  const parcelStatus = Object.fromEntries(['REGISTERED', 'PAYMENT_PENDING', 'ACCEPTED', 'IN_TRANSIT', 'ARRIVED_AT_AGENCY', 'READY_FOR_PICKUP', 'COLLECTED', 'RETURNED'].map((status, i) => [status, parcelCounts[i]]));
  const agentCounts = Object.fromEntries(agentGroups.map(({ status, _count }) => [status, _count._all]));
  const occupancy = todayTrips.map(enrichTrip);
  const capacity = occupancy.reduce((sum, trip) => sum + trip.capacity, 0);
  const booked = occupancy.reduce((sum, trip) => sum + trip.reservedSeats, 0);
  const activity = [...reservations.map((item) => ({ id: `r-${item.id}`, type: 'reservation', label: `Réservation ${item.reservationCode} · ${item.status}`, at: item.createdAt })), ...payments.map((item) => ({ id: `p-${item.id}`, type: 'payment', label: `Paiement ${item.reference || item.id} · ${item.status}`, at: item.createdAt })), ...parcelAlerts.map((item) => ({ id: `c-${item.id}`, type: 'parcel', label: `Colis ${item.trackingCode} · ${item.status}`, at: item.updatedAt }))].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);
  const pendingParcelPickup = parcelStatus.ARRIVED_AT_AGENCY + parcelStatus.READY_FOR_PICKUP;
  return {
    scope: { departmentId, departmentName: department.name, agencyId, agencyName: agencyId ? agencies[0]?.name || null : null },
    kpis: { todayTrips: todayTrips.length, upcomingTrips: upcomingTrips.length, cancelledTrips, completedTrips, todayReservations, pendingReservations, confirmedReservations, cancelledReservations, todayPassengers, totalPassengers: passengers, todayRevenue, revenue, pendingPayments: pendingPayments + pendingParcelPayments, pendingPaymentAmount, pendingParcelPayments, activeParcels: parcelCounts.slice(0, 6).reduce((sum, count) => sum + count, 0), occupancyRate: capacity ? Math.round(100 * booked / capacity) : 0, agentsActive: agentCounts.ACTIVE || 0, agentsInactive: (agentCounts.INACTIVE || 0) + (agentCounts.SUSPENDED || 0) },
    operations: { todayTrips: todayTrips.map(enrichTrip), upcomingTrips: upcomingTrips.map(enrichTrip), pendingReservations: reservations.filter((item) => item.status === 'PENDING'), pendingPayments: payments.filter((item) => item.status === 'PENDING'), parcelAlerts },
    agencies, occupancy, reservations, payments, paymentSummary, parcels: { statuses: parcelStatus, recentAlerts: parcelAlerts }, agents: { active: agentCounts.ACTIVE || 0, inactive: (agentCounts.INACTIVE || 0) + (agentCounts.SUSPENDED || 0) },
    alerts: [(pendingPayments + pendingParcelPayments) > 0 && { id: 'payments', type: 'warning', count: pendingPayments + pendingParcelPayments, message: `${pendingPayments + pendingParcelPayments} paiements nécessitent un suivi` }, pendingReservations > 0 && { id: 'reservations', type: 'info', count: pendingReservations, message: `${pendingReservations} réservations en attente` }, pendingParcelPickup > 0 && { id: 'parcels', type: 'warning', count: pendingParcelPickup, message: `${pendingParcelPickup} colis arrivés attendent leur retrait` }].filter(Boolean), recentActivity: activity,
  };
};

module.exports = { getManagerDashboard };
