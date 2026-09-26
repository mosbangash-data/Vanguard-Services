const crypto = require('crypto');
const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { generateSecureTrackingCode } = require('../utils/cryptoUtils');
const { calculateOfficialPrice } = require('./parcelPricingService');

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizePage = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const normalizeLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  if (parsed < 1) return 1;
  return Math.min(parsed, 50);
};

const normalizePublicDateRange = (dateString) => {
  const value = normalizeString(dateString);
  if (!value) return null;

  const match = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!match) {
    throw new AppError('date must be a valid YYYY-MM-DD value', 400);
  }

  const [year, month, day] = value.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const next = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

  if (Number.isNaN(start.getTime()) || Number.isNaN(next.getTime())) {
    throw new AppError('date must be a valid YYYY-MM-DD value', 400);
  }

  return { gte: start, lt: next };
};

const isPublicTripEligible = (trip, now = new Date()) => {
  if (!trip) return false;
  if (trip.status !== 'SCHEDULED') return false;
  if (!trip.departureAt || new Date(trip.departureAt) <= now) return false;
  if (!trip.schedule) return false;
  if (trip.schedule.status !== 'ACTIVE') return false;
  if (!trip.schedule.route || trip.schedule.route.status !== 'ACTIVE') return false;
  if (!trip.schedule.bus || trip.schedule.bus.status !== 'ACTIVE') return false;
  return true;
};

const getCoachDepartment = async () => {
  const department = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  if (!department) throw new AppError('Vanguard Coach department not found', 404);
  return department;
};

const listPublicTrips = async (query = {}) => {
  const department = await getCoachDepartment();
  const serviceSettings = await prisma.serviceSettings.findUnique({
    where: { departmentId: department.id },
    select: { currency: true },
  });
  const currency = serviceSettings?.currency || 'USD';

  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const skip = (page - 1) * limit;

  const departure = normalizeString(query.departure);
  const arrival = normalizeString(query.arrival);
  const dateRange = normalizePublicDateRange(query.date);
  const now = new Date();

  const where = {
    schedule: {
      departmentId: department.id,
      status: 'ACTIVE',
      route: { status: 'ACTIVE' },
      bus: { status: 'ACTIVE' },
    },
    status: 'SCHEDULED',
    departureAt: { gt: now },
  };

  if (departure) {
    where.schedule.route.departureCity = { contains: departure, mode: 'insensitive' };
  }
  if (arrival) {
    where.schedule.route.arrivalCity = { contains: arrival, mode: 'insensitive' };
  }
  if (dateRange) {
    where.departureAt = { ...dateRange, gt: now };
  }

  const [items, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      skip,
      take: limit,
      orderBy: { departureAt: 'asc' },
      include: {
        schedule: {
          include: {
            route: true,
            bus: true,
            agency: {
              select: {
                id: true,
                code: true,
                name: true,
                city: true,
                phone: true,
              },
            },
          },
        },
      },
    }),
    prisma.trip.count({ where }),
  ]);

  // Calculer les sièges disponibles pour chaque trajet
  const tripsWithAvailability = await Promise.all(
    items.map(async (trip) => {
      const bus = trip.schedule?.bus;
      const totalSeats = bus?.seats || 0;
      const reservedCount = await prisma.reservation.count({
        where: { tripId: trip.id, status: { in: ['PENDING', 'CONFIRMED'] } },
      });
      const availableSeats = Math.max(totalSeats - reservedCount, 0);

      return {
        id: trip.id,
        departureAt: trip.departureAt,
        arrivalAt: trip.arrivalAt,
        status: trip.status,
        route: {
          code: trip.schedule?.route?.code,
          departureCity: trip.schedule?.route?.departureCity,
          arrivalCity: trip.schedule?.route?.arrivalCity,
          distanceKm: trip.schedule?.route?.distanceKm,
          durationHours: trip.schedule?.route?.durationHours,
        },
        schedule: {
          departureTime: trip.schedule?.departureTime,
          returnTime: trip.schedule?.returnTime,
          price: trip.schedule?.price,
          currency,
        },
        bus: {
          brand: bus?.brand,
          model: bus?.model,
          plateNumber: bus?.plateNumber,
          seats: totalSeats,
        },
        availableSeats,
      };
    })
  );

  return { items: tripsWithAvailability, page, limit, total };
};

const getPublicTripSeats = async (tripId) => {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      schedule: {
        include: {
          bus: true,
          route: true,
          agency: true,
        },
      },
    },
  });

  if (!trip) throw new AppError('Trip not found', 404);
  if (!isPublicTripEligible(trip, new Date())) {
    throw new AppError('Trip is not available', 409);
  }

  const bus = trip.schedule?.bus;
  if (!bus) throw new AppError('Bus not found', 404);
  const serviceSettings = await prisma.serviceSettings.findUnique({
    where: { departmentId: trip.schedule.departmentId },
    select: { currency: true },
  });

  const totalSeats = bus.seats || 0;
  const reserved = await prisma.reservation.findMany({
    where: { tripId: trip.id, status: { in: ['PENDING', 'CONFIRMED'] } },
    select: { seatNumber: true },
  });

  const reservedSeats = new Set(reserved.map((r) => r.seatNumber));
  const seats = [];
  for (let i = 1; i <= totalSeats; i++) {
    const seatNumber = String(i);
    seats.push({
      number: seatNumber,
      available: !reservedSeats.has(seatNumber),
    });
  }

  return {
    tripId: trip.id,
    route: {
      code: trip.schedule?.route?.code,
      departureCity: trip.schedule?.route?.departureCity,
      arrivalCity: trip.schedule?.route?.arrivalCity,
    },
    departureAt: trip.departureAt,
    arrivalAt: trip.arrivalAt,
    departureTime: trip.schedule?.departureTime,
    returnTime: trip.schedule?.returnTime,
    price: trip.schedule?.price,
    currency: serviceSettings?.currency || 'USD',
    bus: {
      brand: bus.brand,
      model: bus.model,
      plateNumber: bus.plateNumber,
      seats: totalSeats,
    },
    seats,
  };
};

const createPublicReservation = async (data) => {
  const { tripId, customerName, customerPhone, customerEmail, seatNumber } = data;
  const normalizedSeatNumber = seatNumber === undefined || seatNumber === null ? '' : String(seatNumber).trim();

  if (!tripId || !customerName || !customerPhone || !normalizedSeatNumber) {
    throw new AppError('tripId, customerName, customerPhone and seatNumber are required', 400);
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { schedule: { include: { bus: true, route: true, agency: true } } },
  });
  if (!trip) throw new AppError('Trip not found', 404);
  if (!isPublicTripEligible(trip, new Date())) {
    throw new AppError('Trip is not available', 409);
  }

  const agencyId = trip.schedule?.agencyId ? String(trip.schedule.agencyId).trim() : '';
  if (!agencyId) {
    console.error('[public-reservation-error]', {
      errorId: crypto.randomUUID(),
      message: 'This trip is not assigned to any agency. Reservation cannot be created.',
      statusCode: 400,
      tripId,
      scheduleId: trip.scheduleId,
      agencyId: null,
      departmentId: trip.schedule?.departmentId || null,
    });
    throw new AppError('This trip is not assigned to any agency. Reservation cannot be created.', 400);
  }

  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency || !agency.isActive) {
    throw new AppError('This trip has an invalid agency assignment. Reservation cannot be created.', 400);
  }

  const bus = trip.schedule?.bus;
  if (!bus) throw new AppError('Bus not found', 404);

  const num = Number(normalizedSeatNumber);
  if (!Number.isFinite(num) || num < 1 || num > (bus.seats || 0)) {
    throw new AppError('Invalid seat number', 400);
  }

  const sealedSeatNumber = String(normalizedSeatNumber);

  const result = await prisma.$transaction(async (tx) => {
    try {
      const totalAmount = String(trip.schedule.price ?? '0.00');
      const reservationCode = `RSV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      const reservation = await tx.reservation.create({
        data: {
          reservationCode,
          tripId,
          agencyId,
          customerName: normalizeString(customerName),
          customerPhone: normalizeString(customerPhone),
          customerEmail: customerEmail ? normalizeString(customerEmail) : null,
          seatNumber: sealedSeatNumber,
          totalAmount,
          status: 'PENDING',
          createdByUserId: null,
        },
      });

      const settings = await tx.serviceSettings.findUnique({
        where: { departmentId: trip.schedule.departmentId },
        select: { currency: true },
      });
      const payment = await tx.payment.create({
        data: {
          reservationId: reservation.id,
          agencyId,
          amount: reservation.totalAmount,
          currency: settings?.currency || 'USD',
          channel: 'AGENCY',
          method: 'CASH',
          provider: 'AGENCY',
          status: 'PENDING',
          reference: reservation.reservationCode,
          idempotencyKey: `reservation:${reservation.id}:initial-cash`,
          comment: 'Paiement en espèces à l’agence de départ',
        },
      });

      return { reservation, payment };
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new AppError('Seat already reserved', 409);
      }
      throw error;
    }
  });

  return {
    reservation: {
      id: result.reservation.id,
      reservationCode: result.reservation.reservationCode,
      status: result.reservation.status,
      seatNumber: result.reservation.seatNumber,
      totalAmount: result.reservation.totalAmount,
      tripId: result.reservation.tripId,
      agencyId: result.reservation.agencyId,
    },
    payment: {
      id: result.payment.id,
      reservationId: result.payment.reservationId,
      amount: result.payment.amount,
      currency: result.payment.currency,
      method: result.payment.method,
      channel: result.payment.channel,
      status: result.payment.status,
      createdAt: result.payment.createdAt,
    },
  };
};

const getPublicReservationByCode = async (code) => {
  const reservation = await prisma.reservation.findUnique({
    where: { reservationCode: code },
    include: {
      trip: {
        include: {
          schedule: {
            include: {
              route: true,
              bus: true,
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          reference: true,
          createdAt: true,
        },
      },
      tickets: { select: { ticketCode: true, qrCode: true, status: true, issuedAt: true } },
    },
  });

  if (!reservation) throw new AppError('Reservation not found', 404);

  // Ne retourner que les informations nécessaires au client
  return {
    reservation: {
      id: reservation.id,
      reservationCode: reservation.reservationCode,
      status: reservation.status,
      seatNumber: reservation.seatNumber,
      totalAmount: reservation.totalAmount,
      agencyId: reservation.agencyId,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      customerEmail: reservation.customerEmail,
      createdAt: reservation.createdAt,
      trip: {
        id: reservation.trip.id,
        departureAt: reservation.trip.departureAt,
        arrivalAt: reservation.trip.arrivalAt,
        route: {
          code: reservation.trip.schedule?.route?.code,
          departureCity: reservation.trip.schedule?.route?.departureCity,
          arrivalCity: reservation.trip.schedule?.route?.arrivalCity,
        },
        schedule: {
          departureTime: reservation.trip.schedule?.departureTime,
          returnTime: reservation.trip.schedule?.returnTime,
        },
        bus: {
          brand: reservation.trip.schedule?.bus?.brand,
          model: reservation.trip.schedule?.bus?.model,
          plateNumber: reservation.trip.schedule?.bus?.plateNumber,
        },
      },
      payments: reservation.payments,
      tickets: reservation.tickets,
    },
  };
};

const createPublicReservationPayment = async (reservationId, data) => {
  const { amount, method, reference, comment } = data;

  if (!reservationId) throw new AppError('reservationId is required', 400);
  if (!amount) throw new AppError('amount is required', 400);
  if (!method) throw new AppError('method is required', 400);

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      trip: { include: { schedule: true } },
      payments: true,
    },
  });
  if (!reservation) throw new AppError('Reservation not found', 404);
  if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
    throw new AppError('Reservation is not in a payable state', 409);
  }
  if (!reservation.agencyId) {
    throw new AppError('This reservation is not associated with any agency. Cash payment cannot be recorded.', 400);
  }

  const totalRequiredCents = Math.round(Number(reservation.totalAmount || 0) * 100);
  const totalVerifiedCents = (reservation.payments || [])
    .filter((p) => ['VERIFIED', 'COMPLETED'].includes(p.status))
    .reduce((sum, p) => sum + Math.round(Number(p.amount || 0) * 100), 0);
  const remainingBalanceCents = Math.max(totalRequiredCents - totalVerifiedCents, 0);
  const remainingCents = remainingBalanceCents;

  if (remainingBalanceCents <= 0) {
    throw new AppError('Reservation is already fully paid', 409);
  }

  const currency = 'USD';
  const expectedAmountStr = (remainingBalanceCents / 100).toFixed(2);
  const clientAmountCents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(clientAmountCents) || clientAmountCents !== remainingBalanceCents) {
    throw new AppError(`Invalid payment amount. Exact remaining amount due is ${expectedAmountStr} ${currency}`, 400);
  }

  const amountNum = remainingBalanceCents / 100;
  const idempotencyKey = data.idempotencyKey ? normalizeString(data.idempotencyKey) : null;

  if (idempotencyKey) {
    const existing = await prisma.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        payment: {
          id: existing.id,
          amount: existing.amount,
          currency: existing.currency,
          method: existing.method,
          channel: existing.channel,
          provider: existing.provider,
          status: existing.status,
          reference: existing.reference,
          providerTransactionId: existing.providerTransactionId,
          createdAt: existing.createdAt,
        },
        message: 'Paiement déjà enregistré (idempotence).',
      };
    }
  }

  const normalizedMethod = normalizeString(method).toUpperCase();
  const allowedMethods = new Set(['CASH']);
  if (!allowedMethods.has(normalizedMethod)) {
    throw new AppError('Only CASH is supported for public reservations.', 400);
  }

  const channel = 'AGENCY';
  const provider = 'AGENCY';

  const paymentReference = reference ? normalizeString(reference) : reservation.reservationCode || reservation.id;

  const payment = await prisma.payment.create({
    data: {
      reservationId: reservation.id,
      agencyId: reservation.agencyId,
      amount: amountNum.toFixed(2),
      currency,
      channel,
      provider,
      method: normalizedMethod,
      status: 'PENDING',
      reference: paymentReference,
      idempotencyKey: idempotencyKey || undefined,
      comment: comment ? normalizeString(comment) : null,
    },
  });

  return {
    payment: {
      id: payment.id,
      agencyId: payment.agencyId,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      channel: payment.channel,
      provider: payment.provider,
      status: payment.status,
      reference: payment.reference,
      createdAt: payment.createdAt,
    },
    message: 'Paiement en attente de validation par notre agence.',
  };
};

const createPublicParcel = async (data) => {
  const senderName = normalizeString(data.senderName);
  const senderPhone = normalizeString(data.senderPhone);
  const senderEmail = data.senderEmail ? normalizeString(data.senderEmail) : null;
  const recipientName = normalizeString(data.recipientName);
  const recipientPhone = normalizeString(data.recipientPhone);
  const recipientEmail = data.recipientEmail ? normalizeString(data.recipientEmail) : null;
  const originAgencyId = normalizeString(data.originAgencyId);
  const destinationAgencyId = normalizeString(data.destinationAgencyId);

  if (!senderName || !senderPhone || !recipientName || !recipientPhone) {
    throw new AppError('senderName, senderPhone, recipientName and recipientPhone are required', 400);
  }
  if (!originAgencyId || !destinationAgencyId) {
    throw new AppError('originAgencyId and destinationAgencyId are required', 400);
  }
  if (originAgencyId === destinationAgencyId) {
    throw new AppError('Origin agency and destination agency cannot be the same', 400);
  }

  const [originAgency, destinationAgency] = await Promise.all([
    prisma.agency.findUnique({ where: { id: originAgencyId } }),
    prisma.agency.findUnique({ where: { id: destinationAgencyId } }),
  ]);

  if (!originAgency || !originAgency.isActive) {
    throw new AppError('Origin agency is invalid or inactive', 400);
  }
  if (!destinationAgency || !destinationAgency.isActive) {
    throw new AppError('Destination agency is invalid or inactive', 400);
  }

  const department = await getCoachDepartment();
  if (originAgency.departmentId !== department.id || destinationAgency.departmentId !== department.id) {
    throw new AppError('Agencies must belong to Vanguard Coach', 400);
  }

  const originCity = originAgency.city || 'Kinshasa';
  const destinationCity = destinationAgency.city || 'Lubumbashi';

  const pricing = await calculateOfficialPrice({
    originCity,
    destinationCity,
    weightKg: data.weightKg,
    volumeM3: data.volumeM3,
    category: data.category,
    declaredValue: data.declaredValue,
    departmentId: department.id,
  });

  const trackingCode = generateSecureTrackingCode();
  const initialStatus = 'REGISTERED';

  const parcel = await prisma.$transaction(async (tx) => {
    const created = await tx.parcel.create({
      data: {
        trackingCode,
        senderName,
        senderPhone,
        senderEmail,
        recipientName,
        recipientPhone,
        recipientEmail,
        originCity,
        destinationCity,
        originAgencyId,
        destinationAgencyId,
        category: data.category ? String(data.category).trim().toUpperCase() : 'STANDARD',
        description: data.description ? normalizeString(data.description) : null,
        weightKg: Number(data.weightKg) || 1,
        volumeM3: Number(data.volumeM3) || 0.01,
        declaredValue: data.declaredValue ? Number(data.declaredValue) : null,
        amount: pricing.amount,
        currency: pricing.currency,
        status: initialStatus,
        receivedByUserId: null,
        receivedAt: new Date(),
      },
      include: {
        originAgency: { select: { id: true, code: true, name: true, city: true, phone: true } },
        destinationAgency: { select: { id: true, code: true, name: true, city: true, phone: true } },
      },
    });

    await tx.parcelStatusHistory.create({
      data: {
        parcelId: created.id,
        previousStatus: null,
        newStatus: initialStatus,
        changedByUserId: null,
        reason: 'Enregistrement public du colis en ligne',
        details: { pricingBreakdown: pricing.breakdown },
      },
    });

    return created;
  });

  return {
    parcel: {
      id: parcel.id,
      trackingCode: parcel.trackingCode,
      senderName: parcel.senderName,
      recipientName: parcel.recipientName,
      originCity: parcel.originCity,
      destinationCity: parcel.destinationCity,
      originAgency: parcel.originAgency,
      destinationAgency: parcel.destinationAgency,
      amount: parcel.amount,
      currency: parcel.currency,
      status: parcel.status,
      createdAt: parcel.createdAt,
    },
    pricingBreakdown: pricing.breakdown,
  };
};

const getPublicParcelByTrackingCode = async (trackingCode) => {
  const code = normalizeString(trackingCode);
  if (!code) throw new AppError('trackingCode is required', 400);

  const parcel = await prisma.parcel.findUnique({
    where: { trackingCode: code },
    include: {
      originAgency: { select: { id: true, code: true, name: true, city: true, phone: true } },
      destinationAgency: { select: { id: true, code: true, name: true, city: true, phone: true } },
      statusHistory: {
        orderBy: { changedAt: 'asc' },
        select: {
          previousStatus: true,
          newStatus: true,
          changedAt: true,
          reason: true,
        },
      },
    },
  });

  if (!parcel) throw new AppError('Parcel not found', 404);

  return {
    parcel: {
      trackingCode: parcel.trackingCode,
      senderName: parcel.senderName,
      recipientName: parcel.recipientName,
      originCity: parcel.originCity,
      destinationCity: parcel.destinationCity,
      originAgency: parcel.originAgency,
      destinationAgency: parcel.destinationAgency,
      status: parcel.status,
      weightKg: parcel.weightKg,
      amount: parcel.amount,
      currency: parcel.currency,
      createdAt: parcel.createdAt,
      statusHistory: parcel.statusHistory,
    },
  };
};

module.exports = {
  listPublicTrips,
  getPublicTripSeats,
  createPublicReservation,
  getPublicReservationByCode,
  createPublicParcel,
  getPublicParcelByTrackingCode,
};
