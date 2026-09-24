const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const {
  requireCoachOperational,
  getUserAgencyId,
  assertDepartmentIdForUser,
} = require('./departmentAccessService');

const DAY_MS = 24 * 60 * 60 * 1000;
const VALIDATED_PAYMENT_STATUSES = ['VERIFIED', 'COMPLETED'];
const TRACKED_PARCEL_STATUSES = ['REGISTERED', 'IN_TRANSIT', 'ARRIVED_AT_AGENCY', 'READY_FOR_PICKUP'];

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date) => new Date(startOfDay(date).getTime() + DAY_MS);

const hasPermission = (user, permission) => user.permissions?.includes(permission);

const buildReservationScope = (departmentId, currentUser) => {
  if (currentUser.role === 'AGENT') {
    const agentAgencyId = getUserAgencyId(currentUser);
    return {
      trip: { schedule: { departmentId } },
      OR: [
        { agencyId: agentAgencyId },
        { trip: { schedule: { agencyId: agentAgencyId } } },
      ],
    };
  }
  return {
    trip: { schedule: { departmentId } },
  };
};

const buildTicketScope = (departmentId, currentUser) => ({
  reservation: buildReservationScope(departmentId, currentUser),
});

const buildParcelScope = (departmentId, currentUser) => {
  if (currentUser.role === 'AGENT') {
    const agencyId = getUserAgencyId(currentUser);
    return { OR: [{ originAgencyId: agencyId }, { destinationAgencyId: agencyId }] };
  }

  return {
    OR: [
      { originAgency: { departmentId } },
      { destinationAgency: { departmentId } },
    ],
  };
};

const getCoachDepartmentId = async (currentUser) => {
  const department = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  if (!department) throw new AppError('Vanguard Coach department not found', 404);
  await assertDepartmentIdForUser(currentUser, department.id, 'VANGUARD_COACH');
  return department.id;
};

const mapPayment = (payment) => ({
  id: payment.id,
  amount: payment.amount,
  currency: payment.currency,
  channel: payment.channel,
  method: payment.method,
  status: payment.status,
  reference: payment.reference,
  validatedAt: payment.validatedAt,
  validatedBy: payment.validatedBy,
  createdAt: payment.createdAt,
  reservation: payment.reservation,
});

const getAgentDashboard = async (currentUser) => {
  requireCoachOperational(currentUser);
  const departmentId = await getCoachDepartmentId(currentUser);
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = endOfDay(now);
  const reservationScope = buildReservationScope(departmentId, currentUser);
  const agentAgencyId = currentUser.role === 'AGENT' ? getUserAgencyId(currentUser) : null;
  const tripScope = {
    schedule: {
      departmentId,
      ...(agentAgencyId ? { agencyId: agentAgencyId } : {}),
    },
  };

  const paymentAgencyFilter = agentAgencyId
    ? {
      OR: [
        { agencyId: agentAgencyId },
        { reservation: { agencyId: agentAgencyId } },
        { reservation: { trip: { schedule: { agencyId: agentAgencyId } } } },
      ],
    }
    : {};

  const [todayTrips, upcomingTrips, reservations, todayReservationCount, pendingPayments, validatedToday, pendingTickets, recentScans, parcelCounts] = await Promise.all([
    hasPermission(currentUser, 'VIEW_TRIP')
      ? prisma.trip.findMany({
        where: { ...tripScope, departureAt: { gte: todayStart, lt: tomorrowStart }, status: { not: 'CANCELLED' } },
        orderBy: { departureAt: 'asc' },
        include: { schedule: { include: { route: true, bus: true } } },
      })
      : [],
    hasPermission(currentUser, 'VIEW_TRIP')
      ? prisma.trip.findMany({
        where: { ...tripScope, departureAt: { gte: now }, status: { not: 'CANCELLED' } },
        orderBy: { departureAt: 'asc' },
        take: 10,
        include: { schedule: { include: { route: true, bus: true } } },
      })
      : [],
    hasPermission(currentUser, 'VIEW_RESERVATION')
      ? prisma.reservation.findMany({
        where: { ...reservationScope, status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          trip: { include: { schedule: { include: { route: true, bus: true } } } },
          payments: { select: { id: true, amount: true, currency: true, channel: true, method: true, status: true, validatedAt: true } },
          tickets: { select: { id: true, ticketCode: true, qrCode: true, status: true, issuedAt: true, usedAt: true } },
        },
      })
      : [],
    hasPermission(currentUser, 'VIEW_RESERVATION')
      ? prisma.reservation.count({
        where: {
          ...reservationScope,
          status: { not: 'CANCELLED' },
          trip: { schedule: { departmentId }, departureAt: { gte: todayStart, lt: tomorrowStart } },
        },
      })
      : 0,
    hasPermission(currentUser, 'VIEW_PAYMENT')
      ? prisma.payment.findMany({
        where: {
          reservation: { trip: { schedule: { departmentId } } },
          ...paymentAgencyFilter,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
        include: { reservation: { include: { trip: { include: { schedule: { include: { route: true } } } } } } },
      })
      : [],
    hasPermission(currentUser, 'VIEW_PAYMENT')
      ? prisma.payment.findMany({
        where: {
          reservation: { trip: { schedule: { departmentId } } },
          ...paymentAgencyFilter,
          status: { in: VALIDATED_PAYMENT_STATUSES },
          validatedAt: { gte: todayStart, lt: tomorrowStart },
        },
        orderBy: { validatedAt: 'desc' },
        take: 100,
        include: {
          reservation: { include: { trip: { include: { schedule: { include: { route: true } } } } } },
          validatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      })
      : [],
    hasPermission(currentUser, 'VIEW_RESERVATION')
      ? prisma.ticket.findMany({
        where: {
          ...buildTicketScope(departmentId, currentUser),
          status: 'VALID',
          reservation: {
            ...reservationScope,
            trip: { schedule: { departmentId }, departureAt: { gte: todayStart, lt: tomorrowStart } },
          },
        },
        orderBy: { issuedAt: 'asc' },
        take: 100,
        include: { reservation: { include: { trip: { include: { schedule: { include: { route: true } } } } } } },
      })
      : [],
    hasPermission(currentUser, 'VIEW_TICKET_SCAN')
      ? prisma.ticketScan.findMany({
        where: { ticket: buildTicketScope(departmentId, currentUser) },
        orderBy: { scannedAt: 'desc' },
        take: 50,
        include: {
          ticket: { select: { ticketCode: true, qrCode: true, status: true } },
          scannedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      })
      : [],
    hasPermission(currentUser, 'VIEW_PARCEL')
      ? Promise.all(TRACKED_PARCEL_STATUSES.map((status) => prisma.parcel.count({ where: { ...buildParcelScope(departmentId, currentUser), status } })))
      : [0, 0, 0, 0],
  ]);

  const tripIds = [...new Set([...todayTrips, ...upcomingTrips].map((trip) => trip.id))];
  const reservationsForTrips = tripIds.length && hasPermission(currentUser, 'VIEW_RESERVATION')
    ? await prisma.reservation.findMany({
      where: { ...reservationScope, tripId: { in: tripIds }, status: { not: 'CANCELLED' } },
      select: { tripId: true },
    })
    : [];
  const reservedByTrip = reservationsForTrips.reduce((counts, reservation) => {
    counts[reservation.tripId] = (counts[reservation.tripId] || 0) + 1;
    return counts;
  }, {});

  const enrichTrip = (trip) => {
    const capacity = trip.schedule?.bus?.seats || 0;
    const reserved = reservedByTrip[trip.id] || 0;
    return {
      ...trip,
      seatsReserved: reserved,
      seatsRemaining: Math.max(capacity - reserved, 0),
      occupancyRate: capacity ? Math.round((reserved / capacity) * 100) : 0,
    };
  };

  const paymentTotals = [...pendingPayments, ...validatedToday].reduce((totals, payment) => {
    const channel = payment.channel || 'AGENCY';
    const status = payment.status || 'UNKNOWN';
    totals.byChannel[channel] = (totals.byChannel[channel] || 0) + 1;
    totals.byStatus[status] = (totals.byStatus[status] || 0) + 1;
    totals.amountByCurrency[payment.currency || 'USD'] = (totals.amountByCurrency[payment.currency || 'USD'] || 0) + Number(payment.amount || 0);
    return totals;
  }, { byChannel: {}, byStatus: {}, amountByCurrency: {} });

  return {
    overview: {
      todayTrips: todayTrips.length,
      todayReservations: todayReservationCount,
      pendingPayments: pendingPayments.length,
      ticketsToControl: pendingTickets.length,
    },
    departures: {
      today: todayTrips.map(enrichTrip),
      upcoming: upcomingTrips.map(enrichTrip),
    },
    reservations,
    payments: {
      pending: pendingPayments.map(mapPayment),
      validatedToday: validatedToday.map(mapPayment),
      totals: paymentTotals,
    },
    tickets: {
      pendingControl: pendingTickets,
      recentScans,
    },
    parcels: {
      registered: parcelCounts[0],
      inTransit: parcelCounts[1],
      arrived: parcelCounts[2],
      readyForPickup: parcelCounts[3],
    },
  };
};

module.exports = { getAgentDashboard };
