const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

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
  const date = normalizeString(query.date);

  const where = {
    schedule: {
      departmentId: department.id,
      status: 'ACTIVE',
      route: { status: 'ACTIVE' },
    },
    status: 'SCHEDULED',
  };

  if (departure) {
    where.schedule.route.departureCity = { contains: departure, mode: 'insensitive' };
  }
  if (arrival) {
    where.schedule.route.arrivalCity = { contains: arrival, mode: 'insensitive' };
  }
  if (date) {
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new AppError('date must be a valid ISO date', 400);
    }
    const start = new Date(parsedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(parsedDate);
    end.setHours(23, 59, 59, 999);
    where.departureAt = { gte: start, lte: end };
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
        },
      },
    },
  });

  if (!trip) throw new AppError('Trip not found', 404);
  if (trip.status !== 'SCHEDULED') throw new AppError('Trip is not available', 409);
  if (trip.schedule?.status !== 'ACTIVE') throw new AppError('Trip is not available', 409);

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

  if (!tripId || !customerName || !customerPhone || !seatNumber) {
    throw new AppError('tripId, customerName, customerPhone and seatNumber are required', 400);
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { schedule: { include: { bus: true } } },
  });
  if (!trip) throw new AppError('Trip not found', 404);
  if (trip.status !== 'SCHEDULED') throw new AppError('Trip is not available', 409);
  if (trip.schedule?.status !== 'ACTIVE') throw new AppError('Trip is not available', 409);

  const bus = trip.schedule?.bus;
  if (!bus) throw new AppError('Bus not found', 404);

  const num = Number(seatNumber);
  if (!Number.isFinite(num) || num < 1 || num > (bus.seats || 0)) {
    throw new AppError('Invalid seat number', 400);
  }

  // Vérifier la disponibilité du siège de manière transactionnelle pour éviter les doubles réservations
  const reservation = await prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: { tripId, seatNumber: String(seatNumber), status: { in: ['PENDING', 'CONFIRMED'] } },
    });
    if (existing) throw new AppError('Seat already reserved', 409);

    // Le prix provient du backend, jamais du frontend
    const totalAmount = String(trip.schedule.price ?? '0.00');
    const reservationCode = `RSV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    return tx.reservation.create({
      data: {
        reservationCode,
        tripId,
        customerName: normalizeString(customerName),
        customerPhone: normalizeString(customerPhone),
        customerEmail: customerEmail ? normalizeString(customerEmail) : null,
        seatNumber: String(seatNumber),
        totalAmount,
        status: 'PENDING',
        createdByUserId: null, // Réservation publique sans compte
      },
    });
  });

  return {
    reservation: {
      id: reservation.id,
      reservationCode: reservation.reservationCode,
      status: reservation.status,
      seatNumber: reservation.seatNumber,
      totalAmount: reservation.totalAmount,
      tripId: reservation.tripId,
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

  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new AppError('amount must be a positive number', 400);
  }

  // Le client ne peut jamais passer le paiement à VERIFIED
  const payment = await prisma.payment.create({
    data: {
      reservationId: reservation.id,
      amount: amountNum.toFixed(2),
      method: normalizeString(method).toUpperCase(),
      status: 'PENDING',
      reference: reference ? normalizeString(reference) : null,
      comment: comment ? normalizeString(comment) : null,
    },
  });

  return {
    payment: {
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      reference: payment.reference,
      createdAt: payment.createdAt,
    },
    message: 'Payment declared. It will be verified by our team.',
  };
};

module.exports = {
  listPublicTrips,
  getPublicTripSeats,
  createPublicReservation,
  getPublicReservationByCode,
  createPublicReservationPayment,
};
