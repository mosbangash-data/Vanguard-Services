const crypto = require('crypto');
const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { mbiyoPayProvider } = require('./payment');

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

  const reservation = await prisma.$transaction(async (tx) => {
    try {
      const totalAmount = String(trip.schedule.price ?? '0.00');
      const reservationCode = `RSV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      return await tx.reservation.create({
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
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new AppError('Seat already reserved', 409);
      }
      throw error;
    }
  });

  return {
    reservation: {
      id: reservation.id,
      reservationCode: reservation.reservationCode,
      status: reservation.status,
      seatNumber: reservation.seatNumber,
      totalAmount: reservation.totalAmount,
      tripId: reservation.tripId,
      agencyId: reservation.agencyId,
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
    },
  };
};

const createPublicReservationPayment = async (reservationId, data) => {
  const { amount, method, reference, comment, network, phoneNumber, countryCode } = data;

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
  const allowedMethods = new Set(['CASH', 'MOBILE_MONEY']);
  if (!allowedMethods.has(normalizedMethod)) {
    throw new AppError('Only CASH and MOBILE_MONEY are supported for public reservations.', 400);
  }

  const channel = normalizedMethod === 'MOBILE_MONEY' ? 'ONLINE' : 'AGENCY';
  const provider = normalizedMethod === 'MOBILE_MONEY' ? 'MBIYOPAY' : 'AGENCY';

  const paymentReference = reference ? normalizeString(reference) : reservation.reservationCode || reservation.id;

  if (normalizedMethod === 'MOBILE_MONEY') {
    const resolvedNetwork = normalizeString(network || data.networkName || data.network_name).toUpperCase();
    const validNetworks = new Set(['VODACOM', 'AIRTEL', 'ORANGE', 'AFRICELL']);
    if (!validNetworks.has(resolvedNetwork)) {
      throw new AppError('Invalid Mobile Money network. Supported values: Vodacom, Airtel, Orange, Africell.', 400);
    }

    const phone = normalizeString(phoneNumber || data.phone_number || data.phoneNumber);
    if (!/^\+?[0-9]{7,15}$/.test(phone)) {
      throw new AppError('Invalid mobile phone number.', 400);
    }

    const resolvedCountryCode = normalizeString(countryCode || data.country_code || data.countryCode).toUpperCase();
    if (!['CD', 'RW', 'UG', 'TZ', 'ZM', 'CM', 'GA', 'BJ'].includes(resolvedCountryCode)) {
      throw new AppError('Invalid country code for Mobile Money.', 400);
    }

    const providerInit = await mbiyoPayProvider.initiatePayment({
      amount: amountNum,
      currency,
      reference: paymentReference,
      orderId: reservation.reservationCode,
      description: `Coach reservation ${reservation.reservationCode}`,
      customerPhone: phone,
      metadata: {
        network: resolvedNetwork,
        phone_number: phone,
        country_code: resolvedCountryCode,
      },
    });

    if (!providerInit || providerInit.status === 'FAILED' || providerInit.status === 'PENDING_PROVIDER_SETUP') {
      throw new AppError(providerInit?.message || "Impossible d'initialiser le paiement Mobile Money. Veuillez réessayer.", 502);
    }

    if (!providerInit.providerTransactionId) {
      throw new AppError("Impossible d'initialiser le paiement Mobile Money. Veuillez réessayer.", 502);
    }

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
        providerTransactionId: providerInit.providerTransactionId,
        providerReference: providerInit.providerReference || paymentReference,
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
        providerTransactionId: payment.providerTransactionId,
        createdAt: payment.createdAt,
      },
      message: 'Paiement Mobile Money initié. La confirmation réelle est réservée au webhook MbiyoPay vérifié.',
    };
  }

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

module.exports = {
  listPublicTrips,
  getPublicTripSeats,
  createPublicReservation,
  getPublicReservationByCode,
  createPublicReservationPayment,
};
