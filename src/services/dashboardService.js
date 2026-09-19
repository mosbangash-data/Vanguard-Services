const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

const ACTIVE_AGENT_ROLES = ['AGENT'];
const ACTIVE_ADMIN_ROLES = ['SUPER_ADMIN', 'SERVICE_ADMIN'];
const CURRENCY_KEYS = ['USD', 'CDF'];
const REVENUE_STATUSES = ['VERIFIED', 'COMPLETED'];
const COACH_DEPARTMENT = 'VANGUARD_COACH';

const normalizeCurrency = (value) => {
  const currency = String(value || '').trim().toUpperCase();
  return CURRENCY_KEYS.includes(currency) ? currency : 'USD';
};

const safeNumber = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getScopedDepartment = async (currentUser) => {
  if (!currentUser) {
    throw new AppError('Unauthorized', 401);
  }

  if (currentUser.role === 'SUPER_ADMIN') {
    return { scope: 'global', departmentId: null, departmentType: null };
  }

  if (currentUser.role === 'SERVICE_ADMIN') {
    const departmentType = currentUser.department?.type;
    if (!departmentType) {
      throw new AppError('Access denied', 403);
    }

    const department = await prisma.department.findUnique({ where: { type: departmentType } });
    if (!department) {
      throw new AppError('Access denied', 403);
    }

    return { scope: 'department', departmentId: department.id, departmentType: department.type };
  }

  throw new AppError('Access denied', 403);
};

const buildStatusCounter = (statuses) => Object.fromEntries(statuses.map((status) => [status, 0]));

const enrichStatusCounter = async ({ modelName, where, statuses }) => {
  const rows = await prisma[modelName].groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
  });

  const counter = buildStatusCounter(statuses);
  for (const row of rows) {
    const key = String(row.status);
    if (Object.prototype.hasOwnProperty.call(counter, key)) {
      counter[key] = Number(row._count?._all ?? row._count ?? 0);
    }
  }

  return {
    ...counter,
    total: Object.values(counter).reduce((sum, value) => sum + Number(value || 0), 0),
  };
};

const buildLatestActivity = async () => prisma.auditLog.findMany({
  orderBy: { createdAt: 'desc' },
  take: 10,
  select: {
    id: true,
    action: true,
    actorId: true,
    details: true,
    createdAt: true,
  },
});

const sumRevenueByCurrency = (rows) => {
  const totals = { USD: 0, CDF: 0 };

  for (const row of rows) {
    const amount = safeNumber(row.amount);
    if (!amount) continue;

    const currency = normalizeCurrency(row.currency);
    totals[currency] += amount;
  }

  return totals;
};

const getRevenueForService = async ({ scope, serviceType, paymentField, relationScope }) => {
  const rows = await prisma.payment.findMany({
    where: {
      status: { in: REVENUE_STATUSES },
      [paymentField]: { not: null },
      ...(scope.departmentId ? relationScope(scope.departmentId) : {}),
    },
    select: {
      id: true,
      amount: true,
      [paymentField]: true,
    },
  });

  if (!rows.length) {
    return { USD: 0, CDF: 0 };
  }

  let currencyMap = {};
  if (serviceType === 'transport') {
    const reservationIds = rows.map((row) => row.reservationId).filter(Boolean);
    if (reservationIds.length) {
      const reservations = await prisma.reservation.findMany({
        where: { id: { in: reservationIds } },
        select: {
          id: true,
          trip: {
            select: {
              schedule: {
                select: { departmentId: true },
              },
            },
          },
        },
      });

      const departmentIds = [...new Set(reservations.map((reservation) => reservation.trip?.schedule?.departmentId).filter(Boolean))];
      const settings = await prisma.serviceSettings.findMany({
        where: { departmentId: { in: departmentIds } },
        select: { departmentId: true, currency: true },
      });

      currencyMap = Object.fromEntries(
        settings.map((entry) => [entry.departmentId, normalizeCurrency(entry.currency)])
      );
    }
  }

  if (serviceType === 'autosales') {
    const reservationIds = rows.map((row) => row.vehicleReservationId).filter(Boolean);
    if (reservationIds.length) {
      const reservations = await prisma.vehicleReservation.findMany({
        where: { id: { in: reservationIds } },
        select: {
          id: true,
          vehicle: {
            select: { departmentId: true, currency: true },
          },
        },
      });

      currencyMap = Object.fromEntries(
        reservations.map((reservation) => [reservation.id, normalizeCurrency(reservation.vehicle?.currency)])
      );
    }
  }

  const revenueRows = rows.map((row) => {
    const targetId = serviceType === 'transport' ? row.reservationId : row.vehicleReservationId;
    const currency = serviceType === 'transport'
      ? currencyMap[rows.find((item) => item.id === row.id)?.reservationId] || 'USD'
      : currencyMap[targetId] || 'USD';

    return {
      amount: row.amount,
      currency,
    };
  });

  return sumRevenueByCurrency(revenueRows);
};

const getOverview = async (currentUser) => {
  const scope = await getScopedDepartment(currentUser);

  const tripWhere = scope.departmentId ? { schedule: { departmentId: scope.departmentId } } : {};
  const reservationWhere = scope.departmentId ? { trip: { schedule: { departmentId: scope.departmentId } } } : {};
  const ticketWhere = scope.departmentId ? { reservation: { trip: { schedule: { departmentId: scope.departmentId } } } } : {};
  const vehicleWhere = scope.departmentId ? { departmentId: scope.departmentId } : {};
  const projectWhere = scope.departmentId ? { departmentId: scope.departmentId } : {};
  const quoteRequestWhere = scope.departmentId ? { departmentId: scope.departmentId } : {};
  const vehicleReservationWhere = scope.departmentId ? { vehicle: { departmentId: scope.departmentId } } : {};
  const vehicleInquiryWhere = scope.departmentId ? { vehicle: { departmentId: scope.departmentId } } : {};

  const [
    totalUsers,
    activeUsers,
    activeAgents,
    activeAdmins,
    transportTrips,
    transportReservations,
    transportTickets,
    transportPayments,
    constructionProjects,
    constructionQuoteRequests,
    autoSalesVehicles,
    autoSalesInquiries,
    autoSalesReservations,
    autoSalesPayments,
    activity,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'ACTIVE', role: { name: { in: ACTIVE_AGENT_ROLES } } } }),
    prisma.user.count({ where: { status: 'ACTIVE', role: { name: { in: ACTIVE_ADMIN_ROLES } } } }),
    enrichStatusCounter({ modelName: 'trip', where: tripWhere, statuses: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] }),
    enrichStatusCounter({ modelName: 'reservation', where: reservationWhere, statuses: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] }),
    enrichStatusCounter({ modelName: 'ticket', where: ticketWhere, statuses: ['VALID', 'USED', 'CANCELLED'] }),
    enrichStatusCounter({
      modelName: 'payment',
      where: {
        status: { in: REVENUE_STATUSES },
        reservationId: { not: null },
        ...(scope.departmentId ? { reservation: { trip: { schedule: { departmentId: scope.departmentId } } } } : {}),
      },
      statuses: ['PENDING', 'VERIFIED', 'COMPLETED', 'REJECTED'],
    }),
    enrichStatusCounter({ modelName: 'project', where: projectWhere, statuses: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] }),
    enrichStatusCounter({ modelName: 'quoteRequest', where: quoteRequestWhere, statuses: ['NEW', 'IN_PROGRESS', 'WAITING_FOR_CLIENT', 'CLOSED'] }),
    enrichStatusCounter({ modelName: 'vehicle', where: vehicleWhere, statuses: ['AVAILABLE', 'RESERVED', 'SOLD', 'IN_MAINTENANCE'] }),
    enrichStatusCounter({ modelName: 'vehicleInquiry', where: vehicleInquiryWhere, statuses: ['NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'CONVERTED', 'RESOLVED', 'CLOSED'] }),
    enrichStatusCounter({ modelName: 'vehicleReservation', where: vehicleReservationWhere, statuses: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'] }),
    enrichStatusCounter({
      modelName: 'payment',
      where: {
        ...(scope.departmentId ? { vehicleReservation: { vehicle: { departmentId: scope.departmentId } } } : {}),
        vehicleReservationId: { not: null },
      },
      statuses: ['PENDING', 'VERIFIED', 'COMPLETED', 'REJECTED'],
    }),
    buildLatestActivity(),
  ]);

  const transportRevenue = await getRevenueForService({
    scope,
    serviceType: 'transport',
    paymentField: 'reservationId',
    relationScope: (departmentId) => ({
      reservation: { trip: { schedule: { departmentId } } },
    }),
  });

  const autoSalesRevenue = await getRevenueForService({
    scope,
    serviceType: 'autosales',
    paymentField: 'vehicleReservationId',
    relationScope: (departmentId) => ({
      vehicleReservation: { vehicle: { departmentId } },
    }),
  });

  const revenue = {
    USD: transportRevenue.USD + autoSalesRevenue.USD,
    CDF: transportRevenue.CDF + autoSalesRevenue.CDF,
  };

  const global = {
    totalUsers,
    activeUsers,
    activeAgents,
    activeAdmins,
  };

  const transport = {
    trips: {
      SCHEDULED: transportTrips.SCHEDULED,
      IN_PROGRESS: transportTrips.IN_PROGRESS,
      COMPLETED: transportTrips.COMPLETED,
      CANCELLED: transportTrips.CANCELLED,
      total: transportTrips.total,
    },
    reservations: {
      PENDING: transportReservations.PENDING,
      CONFIRMED: transportReservations.CONFIRMED,
      COMPLETED: transportReservations.COMPLETED,
      CANCELLED: transportReservations.CANCELLED,
      total: transportReservations.total,
    },
    tickets: {
      VALID: transportTickets.VALID,
      USED: transportTickets.USED,
      CANCELLED: transportTickets.CANCELLED,
      total: transportTickets.total,
    },
    payments: {
      PENDING: transportPayments.PENDING,
      VERIFIED: transportPayments.VERIFIED,
      COMPLETED: transportPayments.COMPLETED,
      REJECTED: transportPayments.REJECTED,
    },
    revenue: {
      USD: transportRevenue.USD,
      CDF: transportRevenue.CDF,
    },
  };

  const construction = {
    projects: {
      DRAFT: constructionProjects.DRAFT,
      PUBLISHED: constructionProjects.PUBLISHED,
      ARCHIVED: constructionProjects.ARCHIVED,
      total: constructionProjects.total,
    },
    quoteRequests: {
      NEW: constructionQuoteRequests.NEW,
      IN_PROGRESS: constructionQuoteRequests.IN_PROGRESS,
      WAITING_FOR_CLIENT: constructionQuoteRequests.WAITING_FOR_CLIENT,
      CLOSED: constructionQuoteRequests.CLOSED,
      total: constructionQuoteRequests.total,
    },
  };

  const autoSales = {
    vehicles: {
      AVAILABLE: autoSalesVehicles.AVAILABLE,
      RESERVED: autoSalesVehicles.RESERVED,
      SOLD: autoSalesVehicles.SOLD,
      IN_MAINTENANCE: autoSalesVehicles.IN_MAINTENANCE,
      total: autoSalesVehicles.total,
    },
    inquiries: {
      NEW: autoSalesInquiries.NEW,
      CONTACTED: autoSalesInquiries.CONTACTED,
      IN_PROGRESS: autoSalesInquiries.IN_PROGRESS,
      WAITING_CLIENT: autoSalesInquiries.WAITING_CLIENT,
      CONVERTED: autoSalesInquiries.CONVERTED,
      RESOLVED: autoSalesInquiries.RESOLVED,
      CLOSED: autoSalesInquiries.CLOSED,
      total: autoSalesInquiries.total,
    },
    reservations: {
      PENDING: autoSalesReservations.PENDING,
      CONFIRMED: autoSalesReservations.CONFIRMED,
      COMPLETED: autoSalesReservations.COMPLETED,
      CANCELLED: autoSalesReservations.CANCELLED,
      EXPIRED: autoSalesReservations.EXPIRED,
      total: autoSalesReservations.total,
    },
    payments: {
      PENDING: autoSalesPayments.PENDING,
      VERIFIED: autoSalesPayments.VERIFIED,
      COMPLETED: autoSalesPayments.COMPLETED,
      REJECTED: autoSalesPayments.REJECTED,
    },
    sales: {
      converted: autoSalesInquiries.CONVERTED || 0,
      soldVehicles: autoSalesVehicles.SOLD || 0,
    },
    revenue: {
      USD: autoSalesRevenue.USD,
      CDF: autoSalesRevenue.CDF,
    },
  };

  return {
    global,
    transport,
    construction,
    autoSales,
    revenue,
    recentActivity: activity,
    department: scope.departmentType || null,
  };
};

const parseReportDates = (query = {}) => {
  const period = String(query.period || 'month').trim().toLowerCase();
  const now = new Date();
  let start;
  let end;

  if (period === 'custom') {
    start = new Date(query.startDate);
    end = new Date(query.endDate);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      throw new AppError('startDate and endDate are required for a custom period', 400);
    }
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (period === 'day') {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (period === 'week') {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
  } else if (period === 'month') {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  } else {
    throw new AppError('period must be day, week, month or custom', 400);
  }

  if (end <= start) throw new AppError('endDate must be after startDate', 400);
  return { period, start, end };
};

const incrementCounter = (counter, key) => {
  counter[key] = (counter[key] || 0) + 1;
};

const addCurrencyAmount = (totals, currency, amount) => {
  const normalizedCurrency = normalizeCurrency(currency);
  totals[normalizedCurrency] += safeNumber(amount);
};

const getVanguardCoachSalesReport = async (query = {}, currentUser) => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  if (currentUser.role !== 'SUPER_ADMIN') throw new AppError('Access denied', 403);

  const { period, start, end } = parseReportDates(query);
  const dateWhere = { gte: start, lt: end };
  const coachDepartment = await prisma.department.findUnique({ where: { type: COACH_DEPARTMENT } });
  if (!coachDepartment) throw new AppError('Vanguard Coach department not found', 404);

  const [payments, tickets, parcels] = await Promise.all([
    prisma.payment.findMany({
      where: {
        createdAt: dateWhere,
        OR: [
          { reservation: { trip: { schedule: { departmentId: coachDepartment.id } } } },
          { parcel: { OR: [
            { originAgency: { departmentId: coachDepartment.id } },
            { destinationAgency: { departmentId: coachDepartment.id } },
          ] } },
        ],
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        reservation: {
          select: {
            trip: { select: { schedule: { select: { route: { select: { id: true, code: true, departureCity: true, arrivalCity: true } } } } } },
          },
        },
        parcel: {
          select: {
            originAgency: { select: { id: true, code: true, name: true } },
            destinationAgency: { select: { id: true, code: true, name: true } },
          },
        },
        agency: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.ticket.findMany({
      where: { createdAt: dateWhere, reservation: { trip: { schedule: { departmentId: coachDepartment.id } } } },
      select: { id: true, status: true },
    }),
    prisma.parcel.findMany({
      where: {
        createdAt: dateWhere,
        OR: [
          { originAgency: { departmentId: coachDepartment.id } },
          { destinationAgency: { departmentId: coachDepartment.id } },
        ],
      },
      select: {
        id: true,
        status: true,
        originAgency: { select: { id: true, code: true, name: true } },
        destinationAgency: { select: { id: true, code: true, name: true } },
      },
    }),
  ]);

  const paidStatuses = new Set(REVENUE_STATUSES);
  const paymentStatuses = {};
  const ticketStatuses = {};
  const parcelStatuses = {};
  const ticketRevenue = { USD: 0, CDF: 0 };
  const parcelRevenue = { USD: 0, CDF: 0 };
  const totalRevenue = { USD: 0, CDF: 0 };
  const routeMap = new Map();
  const agencyMap = new Map();

  for (const payment of payments) {
    incrementCounter(paymentStatuses, payment.status);
    if (!paidStatuses.has(payment.status)) continue;
    const isParcel = Boolean(payment.parcel);
    const targetTotals = isParcel ? parcelRevenue : ticketRevenue;
    addCurrencyAmount(targetTotals, payment.currency, payment.amount);
    addCurrencyAmount(totalRevenue, payment.currency, payment.amount);

    if (payment.reservation?.trip?.schedule?.route) {
      const route = payment.reservation.trip.schedule.route;
      const key = route.id;
      const row = routeMap.get(key) || { id: route.id, code: route.code, label: `${route.departureCity} - ${route.arrivalCity}`, payments: 0, revenue: { USD: 0, CDF: 0 } };
      row.payments += 1;
      addCurrencyAmount(row.revenue, payment.currency, payment.amount);
      routeMap.set(key, row);
    }

    if (payment.parcel) {
      const agencies = payment.agency
        ? [payment.agency]
        : [payment.parcel.originAgency, payment.parcel.destinationAgency]
      const uniqueAgencies = [...new Map(agencies.filter(Boolean).map((agency) => [agency.id, agency])).values()];
      for (const agency of uniqueAgencies) {
        if (!agency) continue;
        const row = agencyMap.get(agency.id) || { id: agency.id, code: agency.code, name: agency.name, payments: 0, revenue: { USD: 0, CDF: 0 } };
        row.payments += 1;
        addCurrencyAmount(row.revenue, payment.currency, payment.amount);
        agencyMap.set(agency.id, row);
      }
    }
  }

  for (const ticket of tickets) incrementCounter(ticketStatuses, ticket.status);
  for (const parcel of parcels) incrementCounter(parcelStatuses, parcel.status);

  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    totals: {
      payments: payments.length,
      paidPayments: payments.filter((payment) => paidStatuses.has(payment.status)).length,
      tickets: tickets.length,
      passengers: tickets.filter((ticket) => ticket.status !== 'CANCELLED').length,
      parcels: parcels.length,
    },
    revenue: {
      tickets: ticketRevenue,
      parcels: parcelRevenue,
      total: totalRevenue,
    },
    statuses: {
      payments: paymentStatuses,
      tickets: ticketStatuses,
      parcels: parcelStatuses,
    },
    byRoute: [...routeMap.values()],
    byAgency: [...agencyMap.values()],
  };
};

module.exports = { getOverview, getVanguardCoachSalesReport };
