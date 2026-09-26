const crypto = require('crypto');
const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { getUserAgencyId, assertAgencyAccess, assertDepartmentIdForUser } = require('./departmentAccessService');

const TICKET_STATUS_VALID = 'VALID';
const VALIDATED_PAYMENT_STATUSES = ['VERIFIED', 'COMPLETED'];

const buildTicketCode = () => `TCK-${crypto.randomUUID()}`;
const buildSerialNumber = () => `SN-${Date.now()}-${crypto.randomInt(10000, 99999)}`;
const buildQrCode = (ticketCode) => `vanguard://ticket/${ticketCode}`;
const extractTicketCodeFromQr = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('TCK-')) return trimmed;

  const exactMatch = trimmed.match(/^vanguard:\/\/ticket\/([A-Za-z0-9-]+)$/i);
  if (exactMatch) return exactMatch[1];

  return null;
};

const hasValidatedPayment = (payments = []) => payments.some((payment) => VALIDATED_PAYMENT_STATUSES.includes(payment.status));

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
};

const getTicketByCode = async (ticketCode, currentUser = null) => {
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
  if (currentUser) assertAgencyAccess(currentUser, ticket.reservation?.agencyId);
  return ticket;
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

const getTicketPrintContext = async (ticketCode, actorId = null, currentUser = null) => {
  const ticket = await getTicketByCode(ticketCode, currentUser);

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

  const previousPrints = await prisma.auditLog.count({
    where: {
      action: 'print_ticket',
      details: {
        path: ['targetTicketId'],
        equals: ticket.id,
      },
    },
  });

  const printType = previousPrints > 0 ? 'reprint' : 'first_print';

  await auditService.log('print_ticket', actorId, {
    targetTicketId: ticket.id,
    reservationId: ticket.reservation.id,
    printType,
  });

  return { ticket, printType, currency };
};

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

  const ticketCode = extractTicketCodeFromQr(rawQrCode);
  if (!ticketCode) {
    await prisma.auditLog.create({
      data: {
        action: 'ticket_scan_invalid',
        actorId: currentUser.id,
        details: {
          rawQrCode: typeof rawQrCode === 'string' ? rawQrCode.slice(0, 200) : null,
          reason: 'invalid_qr_format',
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
      ...buildTicketScanResponse(null, 'NOT_FOUND', 'Billet introuvable.', false),
      ticketCode,
    };
  }
  await assertDepartmentIdForUser(currentUser, ticket.reservation.trip.schedule.departmentId, 'VANGUARD_COACH');
  assertAgencyAccess(currentUser, ticket.reservation.agencyId);

  const expectedQrCode = buildQrCode(ticketCode);
  const rawFromClient = typeof rawQrCode === 'string' ? rawQrCode.trim() : '';
  const qrMatches = rawFromClient === expectedQrCode || rawFromClient === ticket.qrCode || rawFromClient === ticketCode;

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

  const ticketCode = buildTicketCode();
  const serialNumber = buildSerialNumber();
  const qrCode = buildQrCode(ticketCode);

  const ticket = await tx.ticket.create({
    data: {
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
      details: { targetTicketId: ticket.id, reservationId },
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
  listTickets,
  listTicketScans,
  getTicketPrintContext,
  scanTicketByQrCode,
  cancelTicketByCode,
  extractTicketCodeFromQr,
  notifyCustomerAboutTicket,
};
