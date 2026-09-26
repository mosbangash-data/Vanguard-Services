const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { requireCoachOperational, getUserAgencyId } = require('./departmentAccessService');

const PAID = ['VERIFIED', 'COMPLETED'];
const PARCEL_STATUSES = ['REGISTERED', 'PAYMENT_PENDING', 'PAID', 'ACCEPTED', 'IN_TRANSIT', 'ARRIVED_AT_AGENCY', 'READY_FOR_PICKUP', 'COLLECTED', 'RETURNED'];
const ACTIVE_PARCEL_STATUSES = ['REGISTERED', 'PAYMENT_PENDING', 'PAID', 'ACCEPTED', 'IN_TRANSIT', 'ARRIVED_AT_AGENCY', 'READY_FOR_PICKUP'];
const startOfDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const endOfDay = (date) => new Date(startOfDay(date).getTime() + 86400000);
const asNumber = (value) => Number(value || 0);

const getManagerDashboard = async (user) => {
  requireCoachOperational(user);
  if (!['MANAGER', 'SERVICE_ADMIN'].includes(user.role)) throw new AppError('Access denied', 403);
  if (!(user.permissions || []).some((permission) => ['VIEW_TRIP', 'VIEW_RESERVATION', 'VIEW_PAYMENT', 'VIEW_PARCEL', 'VIEW_TICKET_SCAN'].includes(permission))) {
    throw new AppError('Insufficient permissions', 403);
  }
  const departmentId = user.departmentId || user.department?.id;
  if (!departmentId || user.department?.type !== 'VANGUARD_COACH') throw new AppError('Access denied', 403);
  // Service Admin supervises the whole Coach department; Manager stays in its assigned agency.
  const agencyId = user.role === 'MANAGER' ? getUserAgencyId(user) : null;
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
  const agencySelect = { id: true, name: true, code: true, city: true, isActive: true };
  if (can('VIEW_TRIP')) agencySelect.schedules = { select: { _count: { select: { trips: true } } } };
  const agencyCountSelect = {};
  if (can('VIEW_RESERVATION')) agencyCountSelect.reservations = true;
  if (can('VIEW_PAYMENT')) agencyCountSelect.payments = true;
  if (can('VIEW_PARCEL')) { agencyCountSelect.originParcels = true; agencyCountSelect.destinationParcels = true; }
  if (can('VIEW_USER')) agencyCountSelect.users = { where: { role: { name: 'AGENT' } } };
  if (Object.keys(agencyCountSelect).length) agencySelect._count = { select: agencyCountSelect };
  const [department, agencies, todayTrips, upcomingTrips, cancelledTrips, completedTrips, todayReservations, pendingReservations, confirmedReservations, cancelledReservations, passengers, todayPassengers, pendingReservationRows, pendingPayments, pendingAmountRows, paidPayments, paidToday, paymentBreakdown, parcelCounts, pendingParcelPayments, pendingParcelAmountRows, agentGroups, ticketGroups, recentScans, reservations, payments, parcelAlerts] = await Promise.all([
    prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true, type: true, settings: { select: { currency: true } } } }),
    prisma.agency.findMany({ where: { departmentId, ...(agencyId ? { id: agencyId } : {}) }, select: agencySelect }),
    can('VIEW_TRIP') ? prisma.trip.findMany({ where: { ...operationalTripScope, departureAt: { gte: now, lt: tomorrow }, status: 'SCHEDULED' }, orderBy: { departureAt: 'asc' }, take: 30, select: { id: true, departureAt: true, status: true, createdAt: true, updatedAt: true, schedule: { select: { route: { select: { departureCity: true, arrivalCity: true } }, bus: { select: { plateNumber: true, seats: true } }, agency: { select: { id: true, name: true } } } } } }) : [],
    can('VIEW_TRIP') ? prisma.trip.findMany({ where: { ...operationalTripScope, departureAt: { gte: tomorrow }, status: 'SCHEDULED' }, orderBy: { departureAt: 'asc' }, take: 10, select: { id: true, departureAt: true, status: true, createdAt: true, updatedAt: true, schedule: { select: { route: { select: { departureCity: true, arrivalCity: true } }, bus: { select: { plateNumber: true, seats: true } }, agency: { select: { id: true, name: true } } } } } }) : [],
    can('VIEW_TRIP') ? prisma.trip.count({ where: { ...tripScope, status: 'CANCELLED', departureAt: { gte: today, lt: tomorrow } } }) : 0,
    can('VIEW_TRIP') ? prisma.trip.count({ where: { ...tripScope, status: 'COMPLETED', departureAt: { gte: today, lt: tomorrow } } }) : 0,
    can('VIEW_RESERVATION') ? prisma.reservation.count({ where: { ...reservationScope, createdAt: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } } }) : 0,
    can('VIEW_RESERVATION') ? prisma.reservation.count({ where: { ...reservationScope, status: 'PENDING' } }) : 0,
    can('VIEW_RESERVATION') ? prisma.reservation.count({ where: { ...reservationScope, status: 'CONFIRMED' } }) : 0,
    can('VIEW_RESERVATION') ? prisma.reservation.count({ where: { ...reservationScope, status: 'CANCELLED' } }) : 0,
    can('VIEW_RESERVATION') ? prisma.reservation.count({ where: { ...reservationScope, status: { in: ['CONFIRMED', 'COMPLETED'] } } }) : 0,
    can('VIEW_RESERVATION') ? prisma.reservation.count({ where: { ...reservationScope, status: { in: ['CONFIRMED', 'COMPLETED'] }, trip: { schedule: { departmentId, ...(agencyId ? { agencyId } : {}) }, departureAt: { gte: today, lt: tomorrow } } } }) : 0,
    can('VIEW_RESERVATION') ? prisma.reservation.findMany({ where: { ...reservationScope, status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 10, select: { id: true, reservationCode: true, customerName: true, customerPhone: true, totalAmount: true, status: true, createdAt: true, agency: { select: { name: true } } } }) : [],
    can('VIEW_PAYMENT') ? prisma.payment.count({ where: { reservation: { is: reservationScope }, ...paymentAgency, status: 'PENDING' } }) : 0,
    can('VIEW_PAYMENT') ? prisma.payment.groupBy({ by: ['currency'], where: { reservation: { is: reservationScope }, ...paymentAgency, status: 'PENDING' }, _sum: { amount: true } }) : [],
    can('VIEW_PAYMENT') ? prisma.payment.groupBy({ by: ['currency'], where: { ...revenuePaymentScope, status: { in: PAID } }, _sum: { amount: true } }) : [],
    can('VIEW_PAYMENT') ? prisma.payment.groupBy({ by: ['currency'], where: { ...revenuePaymentScope, status: { in: PAID }, updatedAt: { gte: today, lt: tomorrow } }, _sum: { amount: true } }) : [],
    can('VIEW_PAYMENT') ? prisma.payment.groupBy({ by: ['channel', 'method', 'status'], where: revenuePaymentScope, _count: { _all: true } }) : [],
    can('VIEW_PARCEL') ? Promise.all(PARCEL_STATUSES.map((status) => prisma.parcel.count({ where: { ...parcelScope, status } }))) : Array(PARCEL_STATUSES.length).fill(0),
    can('VIEW_PARCEL_PAYMENT') ? prisma.payment.count({ where: { parcel: { is: parcelScope }, status: 'PENDING' } }) : 0,
    can('VIEW_PARCEL_PAYMENT') ? prisma.payment.groupBy({ by: ['currency'], where: { parcel: { is: parcelScope }, status: 'PENDING' }, _sum: { amount: true } }) : [],
    can('VIEW_USER') ? prisma.user.groupBy({ by: ['status'], where: { departmentId, ...(agencyId ? { agencyId } : {}), role: { name: 'AGENT' } }, _count: { _all: true } }) : [],
    can('VIEW_TICKET_SCAN') ? prisma.ticket.groupBy({ by: ['status'], where: { reservation: { is: reservationScope } }, _count: { _all: true } }) : [],
    can('VIEW_TICKET_SCAN') ? prisma.ticketScan.findMany({ where: { ticket: { reservation: { is: reservationScope } } }, orderBy: { scannedAt: 'desc' }, take: 10, select: { id: true, scannedAt: true, result: true, ticket: { select: { ticketCode: true, status: true } }, scannedBy: { select: { firstName: true, lastName: true } } } }) : [],
    can('VIEW_RESERVATION') ? prisma.reservation.findMany({ where: reservationScope, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, reservationCode: true, customerName: true, customerPhone: true, seatNumber: true, totalAmount: true, status: true, createdAt: true, agency: { select: { name: true } }, trip: { select: { departureAt: true, schedule: { select: { route: { select: { departureCity: true, arrivalCity: true } } } } } }, payments: can('VIEW_PAYMENT') ? { select: { status: true, currency: true } } : false } }) : [],
    can('VIEW_PAYMENT') ? prisma.payment.findMany({ where: revenuePaymentScope, orderBy: { updatedAt: 'desc' }, take: 10, select: { id: true, reference: true, amount: true, currency: true, channel: true, method: true, status: true, createdAt: true, updatedAt: true, validatedAt: true, agency: { select: { name: true } }, validatedBy: { select: { firstName: true, lastName: true } }, reservation: { select: { reservationCode: true, customerName: true } }, parcel: { select: { trackingCode: true, recipientName: true } } } }) : [],
    can('VIEW_PARCEL') ? prisma.parcel.findMany({ where: { ...parcelScope, status: { in: ['PAYMENT_PENDING', 'ARRIVED_AT_AGENCY', 'READY_FOR_PICKUP'] } }, orderBy: { updatedAt: 'desc' }, take: 10, select: { id: true, trackingCode: true, senderName: true, recipientName: true, status: true, updatedAt: true, originAgency: { select: { name: true } }, destinationAgency: { select: { name: true } }, payments: can('VIEW_PARCEL_PAYMENT') ? { select: { status: true } } : false } }) : [],
  ]);
  if (!department) throw new AppError('Department not found', 404);
  const agencyIds = agencies.map((agency) => agency.id);
  const [agencyRevenueGroups, agencyAgentGroups] = await Promise.all([
    can('VIEW_PAYMENT') && agencyIds.length ? prisma.payment.groupBy({ by: ['agencyId', 'currency'], where: { agencyId: { in: agencyIds }, status: { in: PAID } }, _sum: { amount: true } }) : [],
    can('VIEW_USER') && agencyIds.length ? prisma.user.groupBy({ by: ['agencyId', 'status'], where: { departmentId, agencyId: { in: agencyIds }, role: { name: 'AGENT' } }, _count: { _all: true } }) : [],
  ]);
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
  const pendingCashToValidate = paymentBreakdown.filter((row) => row.channel === 'AGENCY' && row.status === 'PENDING' && String(row.method || '').toUpperCase() === 'CASH').reduce((sum, row) => sum + (row._count?._all || 0), 0);
  const pendingOnline = paymentBreakdown.filter((row) => row.channel === 'ONLINE' && ['PENDING', 'PROCESSING'].includes(row.status)).reduce((sum, row) => sum + (row._count?._all || 0), 0);
  const parcelStatus = Object.fromEntries(PARCEL_STATUSES.map((status, i) => [status, parcelCounts[i]]));
  const activeParcels = ACTIVE_PARCEL_STATUSES.reduce((sum, status) => sum + parcelStatus[status], 0);
  const agentCounts = Object.fromEntries(agentGroups.map(({ status, _count }) => [status, _count._all]));
  const agentsByAgency = agencyAgentGroups.reduce((map, row) => { const metrics = map.get(row.agencyId) || { active: 0, inactive: 0 }; if (row.status === 'ACTIVE') metrics.active += row._count._all; else metrics.inactive += row._count._all; map.set(row.agencyId, metrics); return map; }, new Map());
  const revenueByAgency = agencyRevenueGroups.reduce((map, row) => { if (!row.agencyId) return map; const totals = map.get(row.agencyId) || {}; totals[row.currency || 'USD'] = asNumber(row._sum?.amount); map.set(row.agencyId, totals); return map; }, new Map());
  const agencyMetrics = agencies.map((agency) => ({ id: agency.id, name: agency.name, code: agency.code, city: agency.city, isActive: agency.isActive, ...(can('VIEW_TRIP') ? { trips: (agency.schedules || []).reduce((sum, schedule) => sum + (schedule._count?.trips || 0), 0) } : {}), ...(can('VIEW_RESERVATION') ? { reservations: agency._count?.reservations || 0 } : {}), ...(can('VIEW_PAYMENT') ? { payments: agency._count?.payments || 0, revenue: revenueByAgency.get(agency.id) || {} } : {}), ...(can('VIEW_PARCEL') ? { parcels: (agency._count?.originParcels || 0) + (agency._count?.destinationParcels || 0) } : {}), ...(can('VIEW_USER') ? { agents: agentsByAgency.get(agency.id) || { active: 0, inactive: 0 } } : {}) }));
  const ticketStatuses = Object.fromEntries(ticketGroups.map(({ status, _count }) => [status, _count._all]));
  const occupancy = todayTrips.map(enrichTrip);
  const capacity = occupancy.reduce((sum, trip) => sum + trip.capacity, 0);
  const booked = occupancy.reduce((sum, trip) => sum + trip.reservedSeats, 0);
  const activity = [...reservations.map((item) => ({ id: `r-${item.id}`, type: 'reservation', label: `Réservation ${item.reservationCode} · ${item.status}`, at: item.createdAt })), ...payments.map((item) => ({ id: `p-${item.id}`, type: 'payment', label: `Paiement ${item.reference || item.id} · ${item.status}`, at: item.validatedAt || item.updatedAt || item.createdAt })), ...parcelAlerts.map((item) => ({ id: `c-${item.id}`, type: 'parcel', label: `Colis ${item.trackingCode} · ${item.status}`, at: item.updatedAt })), ...[...todayTrips, ...upcomingTrips].map((item) => ({ id: `t-${item.id}`, type: 'trip', label: `Voyage ${item.schedule.route.departureCity} – ${item.schedule.route.arrivalCity} · ${item.status}`, at: item.updatedAt || item.createdAt })), ...recentScans.map((item) => ({ id: `s-${item.id}`, type: 'scan', label: `Scan ${item.ticket.ticketCode} · ${item.result}`, at: item.scannedAt }))].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);
  const pendingParcelPickup = parcelStatus.ARRIVED_AT_AGENCY + parcelStatus.READY_FOR_PICKUP;
  const lowOccupancyTrips = occupancy.filter((trip) => trip.occupancyRate < 25);
  const nearDepartureTrips = todayTrips.filter((trip) => trip.departureAt.getTime() - now.getTime() <= 60 * 60 * 1000);
  return {
    scope: { departmentId, departmentName: department.name, currency: department.settings?.currency || 'USD', agencyId, agencyName: agencyId ? agencies[0]?.name || null : null },
    kpis: { todayTrips: todayTrips.length, upcomingTrips: upcomingTrips.length, cancelledTrips, completedTrips, todayReservations, pendingReservations, confirmedReservations, cancelledReservations, todayPassengers, totalPassengers: passengers, todayRevenue, revenue, pendingPayments: pendingPayments + pendingParcelPayments, pendingPaymentAmount, pendingParcelPayments, pendingCashToValidate, pendingOnline, activeParcels, occupancyRate: capacity ? Math.round(100 * booked / capacity) : 0, agentsActive: agentCounts.ACTIVE || 0, agentsInactive: (agentCounts.INACTIVE || 0) + (agentCounts.SUSPENDED || 0) },
    operations: { todayTrips: todayTrips.map(enrichTrip), upcomingTrips: upcomingTrips.map(enrichTrip), pendingReservations: pendingReservationRows, pendingPayments: payments.filter((item) => item.status === 'PENDING'), parcelAlerts },
    agencies: agencyMetrics, occupancy, reservations, payments, paymentSummary, tickets: { statuses: ticketStatuses, recentScans }, parcels: { statuses: parcelStatus, recentAlerts: parcelAlerts }, agents: { active: agentCounts.ACTIVE || 0, inactive: (agentCounts.INACTIVE || 0) + (agentCounts.SUSPENDED || 0) },
    alerts: [(pendingPayments + pendingParcelPayments) > 0 && { id: 'payments', type: 'warning', count: pendingPayments + pendingParcelPayments, message: `${pendingPayments + pendingParcelPayments} paiements nécessitent un suivi` }, pendingReservations > 0 && { id: 'reservations', type: 'info', count: pendingReservations, message: `${pendingReservations} réservations en attente` }, pendingParcelPickup > 0 && { id: 'parcels', type: 'warning', count: pendingParcelPickup, message: `${pendingParcelPickup} colis arrivés attendent leur retrait` }, lowOccupancyTrips.length > 0 && { id: 'low-occupancy', type: 'info', count: lowOccupancyTrips.length, message: `${lowOccupancyTrips.length} départ(s) ont une occupation inférieure à 25 %` }, nearDepartureTrips.length > 0 && { id: 'near-departure', type: 'warning', count: nearDepartureTrips.length, message: `${nearDepartureTrips.length} départ(s) sont prévus dans moins d’une heure` }].filter(Boolean), recentActivity: activity,
  };
};

module.exports = { getManagerDashboard };
