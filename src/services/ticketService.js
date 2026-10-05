const crypto = require('crypto');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { AppError } = require('../middleware/errorHandler');
const { getUserAgencyId, assertAgencyAccess, assertDepartmentIdForUser } = require('./departmentAccessService');
const { buildSignedTicketQr, parseSignedTicketQr, verifyTicketQrSignature, extractTicketCodeFromQr } = require('../utils/ticketQr');

const TICKET_STATUS_VALID = 'VALID';
const VALIDATED_PAYMENT_STATUSES = ['VERIFIED', 'COMPLETED'];

const buildTicketCode = () => `VG-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
const buildSerialNumber = () => `SN-${Date.now()}-${crypto.randomInt(10000, 99999)}`;
const hasValidatedPayment = (payments = []) => payments.some((payment) => payment.method === 'CASH' && VALIDATED_PAYMENT_STATUSES.includes(payment.status));
const isReservationFullyPaid = (reservation) => {
  const paidCents = (reservation.payments || []).filter((payment) => payment.method === 'CASH' && VALIDATED_PAYMENT_STATUSES.includes(payment.status))
    .reduce((sum, payment) => sum + Math.round(Number(payment.amount) * 100), 0);
  return paidCents >= Math.round(Number(reservation.totalAmount) * 100);
};

const ensureCoachTicketAccess = (currentUser) => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  if (currentUser.role !== 'SUPER_ADMIN' && currentUser.department?.type !== 'VANGUARD_COACH') {
    throw new AppError('Access denied', 403);
  }
  if (!currentUser.permissions?.includes('VIEW_RESERVATION') && !currentUser.permissions?.includes('MANAGE_RESERVATION_PAYMENT')) {
    throw new AppError('Insufficient permissions', 403);
  }
};

const ensureCoachReservation = async (reservation) => {
  if (!reservation || !reservation.trip || !reservation.trip.schedule) {
    throw new AppError('Reservation workflow is invalid', 400);
  }

  const departmentId = reservation.trip.schedule.departmentId;
  if (!departmentId) {
    throw new AppError('Reservation workflow is invalid', 400);
  }

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    throw new AppError('Reservation workflow is invalid', 400);
  }
  if (department.type !== 'VANGUARD_COACH') {
    throw new AppError('Ticket generation only supported for Vanguard Coach reservations', 400);
  }
};

const ensureReservationReadyForTicket = (reservation) => {
  if (!reservation) throw new AppError('Reservation not found', 404);
  if (reservation.status !== 'CONFIRMED') {
    throw new AppError('Ticket can only be generated for confirmed reservations', 409);
  }
  if (!hasValidatedPayment(reservation.payments)) {
    throw new AppError('Ticket can only be generated after a validated payment', 409);
  }
  if (!isReservationFullyPaid(reservation)) throw new AppError('Ticket can only be generated after the full cash amount is validated', 409);
};

const getTicketByCode = async (ticketCode, currentUser = null) => {
  if (currentUser) ensureCoachTicketAccess(currentUser);
  const ticket = await prisma.ticket.findUnique({
    where: { ticketCode },
    select: {
      id: true,
      reservationId: true,
      ticketCode: true,
      qrCode: true,
      serialNumber: true,
      status: true,
      issuedAt: true,
      usedAt: true,
      createdAt: true,
      reservation: {
        select: {
          id: true,
          reservationCode: true,
          agencyId: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          seatNumber: true,
          totalAmount: true,
          status: true,
          payments: { select: { amount: true, currency: true, method: true, status: true, validatedAt: true } },
          trip: {
            select: {
              id: true,
              departureAt: true,
              arrivalAt: true,
              schedule: {
                select: {
                  departureTime: true,
                  returnTime: true,
                  route: {
                    select: {
                      code: true,
                      departureCity: true,
                      arrivalCity: true,
                    },
                  },
                  bus: {
                    select: {
                      plateNumber: true,
                      brand: true,
                      model: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!ticket) throw new AppError('Ticket not found', 404);
  ensureReservationReadyForTicket(ticket.reservation);
  if (currentUser) assertAgencyAccess(currentUser, ticket.reservation?.agencyId || ticket.reservation?.trip?.schedule?.agencyId);
  return ticket;
};

const getPublicTicketByCode = async (ticketCode) => {
  const ticket = await prisma.ticket.findUnique({
    where: { ticketCode },
    select: {
      ticketCode: true, qrCode: true, status: true, issuedAt: true, usedAt: true,
      reservation: { select: {
        customerName: true, customerPhone: true, seatNumber: true, status: true, totalAmount: true, payments: { select: { status: true, method: true, amount: true } },
        trip: { select: { departureAt: true, schedule: { select: { departureTime: true, route: { select: { departureCity: true, arrivalCity: true } } } } } },
      } },
    },
  });
  if (!ticket || ticket.reservation.status !== 'CONFIRMED' || !isReservationFullyPaid(ticket.reservation)) {
    throw new AppError('Ticket not found', 404);
  }
  const { reservation, ...publicTicket } = ticket;
  return {
    ticket: {
      ...publicTicket,
      isPaid: true,
      reservation: {
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        seatNumber: reservation.seatNumber,
        trip: reservation.trip,
      },
    },
  };
};

const getCoachDepartmentIdForUser = async (currentUser) => {
  ensureCoachTicketAccess(currentUser);
  const department = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  if (!department) throw new AppError('Vanguard Coach department not found', 404);
  await assertDepartmentIdForUser(currentUser, department.id, 'VANGUARD_COACH');
  return department.id;
};

const listTickets = async ({ search = '', status, page = 1, limit = 50 } = {}, currentUser) => {
  const departmentId = await getCoachDepartmentIdForUser(currentUser);
  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const skip = Math.max((Number(page) || 1) - 1, 0) * take;
  const term = String(search).trim();
  const reservationScope = currentUser.role === 'AGENT'
    ? { agencyId: getUserAgencyId(currentUser), trip: { schedule: { departmentId } } }
    : { trip: { schedule: { departmentId } } };
  const where = {
    reservation: reservationScope,
    ...(status ? { status } : {}),
    ...(term ? { OR: [
      { ticketCode: { contains: term, mode: 'insensitive' } },
      { serialNumber: { contains: term, mode: 'insensitive' } },
      { reservation: { customerName: { contains: term, mode: 'insensitive' } } },
      { reservation: { reservationCode: { contains: term, mode: 'insensitive' } } },
    ] } : {}),
  };
  const [tickets, total, settings] = await Promise.all([
    prisma.ticket.findMany({ where, skip, take, orderBy: { issuedAt: 'desc' }, include: { reservation: { include: { trip: { include: { schedule: { include: { route: true } } } } } } } }),
    prisma.ticket.count({ where }),
    prisma.serviceSettings.findUnique({ where: { departmentId }, select: { currency: true } }),
  ]);
  return { tickets, total, page: Number(page) || 1, currency: settings?.currency || 'USD' };
};

const listTicketScans = async ({ ticketCode, page = 1, limit = 50 } = {}, currentUser) => {
  const departmentId = await getCoachDepartmentIdForUser(currentUser);
  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const skip = Math.max((Number(page) || 1) - 1, 0) * take;
  const where = {
    ticket: {
      reservation: currentUser.role === 'AGENT'
        ? { agencyId: getUserAgencyId(currentUser), trip: { schedule: { departmentId } } }
        : { trip: { schedule: { departmentId } } },
      ...(ticketCode ? { ticketCode } : {}),
    },
  };
  const [scans, total] = await Promise.all([
    prisma.ticketScan.findMany({ where, skip, take, orderBy: { scannedAt: 'desc' }, include: { ticket: { select: { ticketCode: true, status: true } }, scannedBy: { select: { firstName: true, lastName: true, email: true } } } }),
    prisma.ticketScan.count({ where }),
  ]);
  return { scans, total, page: Number(page) || 1 };
};

const getTicketPrintContext = async (ticketCode, actorId = null, currentUser = null, printMetadata = {}) => {
  ensureCoachTicketAccess(currentUser);
  const ticket = await getTicketByCode(ticketCode, currentUser);

  const printType = await recordTicketPrintAudit(ticket, actorId, printMetadata);

  // Récupérer la devise depuis ServiceSettings du département
  let currency = 'USD';
  try {
    const department = await prisma.department.findUnique({
      where: { type: 'VANGUARD_COACH' },
      include: { settings: true },
    });
    if (department?.settings?.currency) {
      currency = department.settings.currency;
    }
  } catch {
    // Fallback to USD if settings cannot be loaded
  }

  return { ticket, printType, currency };
};

const recordTicketPrintAudit = async (ticket, actorId = null, printMetadata = {}) => {
  if (typeof ticket === 'string') ticket = await getTicketByCode(ticket);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ticket.id})::bigint)`;
    const previousPrints = await tx.auditLog.count({
      where: { action: 'print_ticket', details: { path: ['targetTicketId'], equals: ticket.id } },
    });
    const printType = previousPrints > 0 ? 'reprint' : 'first_print';
    await tx.auditLog.create({
      data: {
        action: 'print_ticket',
        actorId,
        details: {
          targetTicketId: ticket.id,
          reservationId: ticket.reservation.id,
          agencyId: ticket.reservation.agencyId || ticket.reservation.trip?.schedule?.agencyId,
          printType,
          printFormat: printMetadata.format || '80mm',
          printerMode: 'system',
        },
      },
    });
    return printType;
  });
};

const recordPublicTicketPrint = async (ticketCode, printMetadata = {}) => recordTicketPrintAudit(ticketCode, null, printMetadata);

const buildTicketScanResponse = (ticket, status, message, valid) => {
  const route = ticket?.reservation?.trip?.schedule?.route;
  const trip = ticket?.reservation?.trip;
  const schedule = trip?.schedule;
  const reservation = ticket?.reservation;

  return {
    valid,
    status,
    ticketCode: ticket?.ticketCode || null,
    passengerName: reservation?.customerName || null,
    route: route ? `${route.departureCity} → ${route.arrivalCity}` : null,
    departureDate: trip?.departureAt ? new Date(trip.departureAt).toISOString().slice(0, 10) : null,
    departureTime: schedule?.departureTime || null,
    seatNumber: reservation?.seatNumber || null,
    message,
  };
};

const cancelledTicketScan = async (ticket, currentUser, reason = 'ticket cancelled') => {
  await prisma.ticketScan.create({
    data: {
      ticketId: ticket.id,
      scannedByUserId: currentUser.id,
      result: 'INVALID',
      notes: reason,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'ticket_scan_cancelled',
      actorId: currentUser.id,
      details: {
        targetTicketId: ticket.id,
        ticketCode: ticket.ticketCode,
        reason,
      },
    },
  });
};

const scanTicketByQrCode = async (rawQrCode, currentUser) => {
  ensureCoachTicketAccess(currentUser);

  const qrPayload = parseSignedTicketQr(rawQrCode, env.ticketQrSecret);
  const ticketCode = qrPayload?.ticketCode;
  if (!qrPayload || !ticketCode) {
    await prisma.auditLog.create({
      data: {
        action: 'ticket_scan_invalid',
        actorId: currentUser.id,
        details: {
          reason: 'invalid_or_unsigned_qr',
        },
      },
    });

    return {
      ...buildTicketScanResponse(null, 'INVALID', 'QR Code invalide.', false),
      ticketCode: null,
    };
  }

  const ticket = await prisma.ticket.findUnique({
    where: { ticketCode },
    include: {
      reservation: {
        include: {
          payments: { select: { status: true, method: true, amount: true } },
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
        },
      },
    },
  });

  if (!ticket) {
    await prisma.auditLog.create({
      data: {
        action: 'ticket_scan_not_found',
        actorId: currentUser.id,
        details: {
          ticketCode,
          rawQrCode: typeof rawQrCode === 'string' ? rawQrCode.slice(0, 200) : null,
        },
      },
    });

    return {
      ...buildTicketScanResponse(null, 'INVALID', 'Billet introuvable.', false),
      ticketCode,
    };
  }
  await assertDepartmentIdForUser(currentUser, ticket.reservation.trip.schedule.departmentId, 'VANGUARD_COACH');
  assertAgencyAccess(currentUser, ticket.reservation.agencyId || ticket.reservation.trip?.schedule?.agencyId);

  const qrMatches = verifyTicketQrSignature(rawQrCode, ticketCode, env.ticketQrSecret)
    && qrPayload.ticketId === ticket.id
    && qrPayload.tripId === ticket.reservation.tripId
    && ticket.qrCode === rawQrCode.trim();

  if (!qrMatches) {
    await prisma.ticketScan.create({
      data: {
        ticketId: ticket.id,
        scannedByUserId: currentUser.id,
        result: 'INVALID',
        notes: 'QR mismatch',
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'ticket_scan_invalid',
        actorId: currentUser.id,
        details: {
          targetTicketId: ticket.id,
          ticketCode,
          reason: 'qr_mismatch',
        },
      },
    });

    return {
      ...buildTicketScanResponse(ticket, 'INVALID', 'QR Code invalide.', false),
      ticketCode,
    };
  }

  if (ticket.reservation.status !== 'CONFIRMED' || !isReservationFullyPaid(ticket.reservation)) {
    return { ...buildTicketScanResponse(ticket, 'INVALID', 'Réservation ou paiement non validé.', false), ticketCode };
  }
  if (ticket.reservation.trip.departureAt && new Date(ticket.reservation.trip.departureAt) < new Date()) {
    await prisma.ticketScan.create({ data: { ticketId: ticket.id, scannedByUserId: currentUser.id, result: 'INVALID', notes: 'trip_departure_expired' } });
    return { ...buildTicketScanResponse(ticket, 'EXPIRED', 'Billet expiré : le départ est passé.', false), ticketCode };
  }
  if (['CANCELLED', 'COMPLETED'].includes(ticket.reservation.trip.status)) {
    await prisma.ticketScan.create({ data: { ticketId: ticket.id, scannedByUserId: currentUser.id, result: 'INVALID', notes: `trip_${ticket.reservation.trip.status.toLowerCase()}` } });
    return { ...buildTicketScanResponse(ticket, 'INVALID', 'Voyage annulé ou terminé.', false), ticketCode };
  }

  if (ticket.status === 'CANCELLED') {
    await cancelledTicketScan(ticket, currentUser, 'ticket_status_cancelled');
    return {
      ...buildTicketScanResponse(ticket, 'CANCELLED', 'Billet annulé.', false),
      ticketCode: ticket.ticketCode,
    };
  }

  if (ticket.status === 'USED') {
    await prisma.ticketScan.create({
      data: {
        ticketId: ticket.id,
        scannedByUserId: currentUser.id,
        result: 'ALREADY_USED',
        notes: 'Already used ticket was scanned again',
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'ticket_scan_used',
        actorId: currentUser.id,
        details: {
          targetTicketId: ticket.id,
          ticketCode: ticket.ticketCode,
          reason: 'already_used',
          reservationId: ticket.reservationId,
          agencyId: ticket.reservation?.agencyId || ticket.reservation?.trip?.schedule?.agencyId,
        },
      },
    });

    return {
      ...buildTicketScanResponse(ticket, 'USED', 'Billet déjà utilisé.', false),
      ticketCode: ticket.ticketCode,
    };
  }

  if (ticket.status !== 'VALID') {
    await prisma.ticketScan.create({
      data: {
        ticketId: ticket.id,
        scannedByUserId: currentUser.id,
        result: 'INVALID',
        notes: `Ticket status ${ticket.status}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'ticket_scan_invalid',
        actorId: currentUser.id,
        details: {
          targetTicketId: ticket.id,
          ticketCode: ticket.ticketCode,
          reason: `unexpected_status_${ticket.status}`,
        },
      },
    });

    return {
      ...buildTicketScanResponse(ticket, 'INVALID', 'Billet invalide.', false),
      ticketCode: ticket.ticketCode,
    };
  }

  const scanResult = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.updateMany({
      where: { id: ticket.id, status: 'VALID' },
      data: {
        status: 'USED',
        usedAt: new Date(),
      },
    });

    if (updated.count !== 1) {
      const refreshed = await tx.ticket.findUnique({
        where: { id: ticket.id },
        select: { id: true, ticketCode: true, status: true, usedAt: true },
      });

      if (refreshed?.status === 'USED') {
        const alreadyUsedScan = await tx.ticketScan.create({
          data: {
            ticketId: ticket.id,
            scannedByUserId: currentUser.id,
            result: 'ALREADY_USED',
            notes: 'concurrent scan prevented validation',
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'ticket_scan_used',
            actorId: currentUser.id,
            details: {
              targetTicketId: ticket.id,
              ticketCode: ticket.ticketCode,
              reason: 'concurrent_update',
              ticketScanId: alreadyUsedScan.id,
            },
          },
        });

        return {
          valid: false,
          status: 'USED',
          ticketCode: ticket.ticketCode,
          passengerName: ticket.reservation?.customerName || null,
          route: ticket.reservation?.trip?.schedule?.route ? `${ticket.reservation.trip.schedule.route.departureCity} → ${ticket.reservation.trip.schedule.route.arrivalCity}` : null,
          departureDate: ticket.reservation?.trip?.departureAt ? new Date(ticket.reservation.trip.departureAt).toISOString().slice(0, 10) : null,
          departureTime: ticket.reservation?.trip?.schedule?.departureTime || null,
          seatNumber: ticket.reservation?.seatNumber || null,
          message: 'Billet déjà utilisé.',
        };
      }

      const invalidScan = await tx.ticketScan.create({
        data: {
          ticketId: ticket.id,
          scannedByUserId: currentUser.id,
          result: 'INVALID',
          notes: 'status changed during validation',
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ticket_scan_invalid',
          actorId: currentUser.id,
          details: {
            targetTicketId: ticket.id,
            ticketCode: ticket.ticketCode,
            ticketScanId: invalidScan.id,
            reason: 'status_changed_during_validation',
          },
        },
      });

      return {
        valid: false,
        status: 'INVALID',
        ticketCode: ticket.ticketCode,
        passengerName: ticket.reservation?.customerName || null,
        route: ticket.reservation?.trip?.schedule?.route ? `${ticket.reservation.trip.schedule.route.departureCity} → ${ticket.reservation.trip.schedule.route.arrivalCity}` : null,
        departureDate: ticket.reservation?.trip?.departureAt ? new Date(ticket.reservation.trip.departureAt).toISOString().slice(0, 10) : null,
        departureTime: ticket.reservation?.trip?.schedule?.departureTime || null,
        seatNumber: ticket.reservation?.seatNumber || null,
        message: 'Billet invalide.',
      };
    }

    const acceptedScan = await tx.ticketScan.create({
      data: {
        ticketId: ticket.id,
        scannedByUserId: currentUser.id,
        result: 'SUCCESS',
        notes: 'first valid scan',
      },
    });

    const updatedTicket = await tx.ticket.findUnique({
      where: { id: ticket.id },
      include: {
        reservation: {
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
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        action: 'ticket_scan_valid',
        actorId: currentUser.id,
        details: {
          targetTicketId: ticket.id,
          ticketCode: ticket.ticketCode,
          ticketScanId: acceptedScan.id,
          reservationId: ticket.reservationId,
          agencyId: ticket.reservation?.agencyId || ticket.reservation?.trip?.schedule?.agencyId,
        },
      },
    });

    return {
      valid: true,
      status: 'VALID',
      ticketCode: updatedTicket.ticketCode,
      passengerName: updatedTicket.reservation?.customerName || null,
      route: updatedTicket.reservation?.trip?.schedule?.route ? `${updatedTicket.reservation.trip.schedule.route.departureCity} → ${updatedTicket.reservation.trip.schedule.route.arrivalCity}` : null,
      departureDate: updatedTicket.reservation?.trip?.departureAt ? new Date(updatedTicket.reservation.trip.departureAt).toISOString().slice(0, 10) : null,
      departureTime: updatedTicket.reservation?.trip?.schedule?.departureTime || null,
      seatNumber: updatedTicket.reservation?.seatNumber || null,
      message: 'Billet valide.',
    };
  });

  return scanResult;
};

const cancelTicketByCode = async (ticketCode, currentUser) => {
  ensureCoachTicketAccess(currentUser);

  const ticket = await prisma.ticket.findUnique({
    where: { ticketCode },
    include: {
      reservation: {
        include: {
          trip: {
            include: {
              schedule: {
                include: {
                  route: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!ticket) throw new AppError('Ticket not found', 404);
  await assertDepartmentIdForUser(currentUser, ticket.reservation.trip.schedule.departmentId, 'VANGUARD_COACH');

  const updated = await prisma.$transaction(async (tx) => {
    const cancelledTicket = await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: 'CANCELLED' },
    });

    await tx.ticketScan.create({
      data: {
        ticketId: ticket.id,
        scannedByUserId: currentUser.id,
        result: 'INVALID',
        notes: 'Ticket cancelled by staff',
      },
    });

    await tx.auditLog.create({
      data: {
        action: 'ticket_cancelled',
        actorId: currentUser.id,
        details: {
          targetTicketId: ticket.id,
          ticketCode: ticket.ticketCode,
        },
      },
    });

    return cancelledTicket;
  });

  return { ticket: updated };
};

const createTicketForReservationInTransaction = async (tx, reservationId, currentUser) => {
  ensureCoachTicketAccess(currentUser);
  if (!reservationId || typeof reservationId !== 'string' || !reservationId.trim()) {
    throw new AppError('Reservation ID is required', 400);
  }

  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    include: {
      trip: { include: { schedule: { include: { route: true, bus: true } } } },
      payments: true,
      tickets: true,
    },
  });
  ensureCoachReservation(reservation);
  await assertDepartmentIdForUser(currentUser, reservation.trip.schedule.departmentId, 'VANGUARD_COACH');
  ensureReservationReadyForTicket(reservation);

  const existingTicket = reservation.tickets[0];
  if (existingTicket) {
    return { ticket: existingTicket, created: false };
  }

  const id = crypto.randomUUID();
  let ticketCode = buildTicketCode();
  while (await tx.ticket.findUnique({ where: { ticketCode }, select: { id: true } })) ticketCode = buildTicketCode();
  const serialNumber = buildSerialNumber();
  const issuedAt = new Date();
  const expiresAt = new Date(reservation.trip.departureAt);
  expiresAt.setTime(expiresAt.getTime() + 24 * 60 * 60 * 1000);
  const qrCode = buildSignedTicketQr({ ticketCode, ticketId: id, tripId: reservation.tripId, issuedAt, expiresAt }, env.ticketQrSecret);

  const ticket = await tx.ticket.create({
    data: {
      id,
      ticketCode,
      reservationId,
      qrCode,
      serialNumber,
      status: TICKET_STATUS_VALID,
      issuedByUserId: currentUser?.id || null,
    },
    include: {
      reservation: {
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
        },
      },
      issuedBy: true,
    },
  });

  await tx.auditLog.create({
    data: {
      action: 'create_ticket',
      actorId: currentUser?.id || null,
      details: { targetTicketId: ticket.id, reservationId, agencyId: reservation.agencyId || reservation.trip?.schedule?.agencyId, paymentIds: reservation.payments.map((payment) => payment.id) },
    },
  });

  return { ticket, created: true };
};

const createTicketForReservation = async (reservationId, currentUser) => prisma.$transaction((tx) =>
  createTicketForReservationInTransaction(tx, reservationId, currentUser));

const notifyCustomerAboutTicket = async (ticket) => {
  // Placeholder for future delivery integration (WhatsApp, SMS, email).
  // Next delivery can implement a sendTicketToCustomer(ticket) hook here.
  return null;
};

module.exports = {
  createTicketForReservation,
  createTicketForReservationInTransaction,
  getTicketByCode,
  getPublicTicketByCode,
  listTickets,
  listTicketScans,
  getTicketPrintContext,
  recordPublicTicketPrint,
  scanTicketByQrCode,
  cancelTicketByCode,
  extractTicketCodeFromQr,
  verifyTicketQrSignature,
  notifyCustomerAboutTicket,
};
