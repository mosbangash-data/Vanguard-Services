const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { mbiyoPayProvider } = require('./payment');
const ticketService = require('./ticketService');
const { getUserAgencyId, assertAgencyAccess, assertDepartmentIdForUser } = require('./departmentAccessService');

const moneyToCents = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Invalid payment amount', 409);
  const cents = Math.round(amount * 100);
  if (Math.abs(amount - cents / 100) > Number.EPSILON) throw new AppError('Invalid payment precision', 409);
  return cents;
};

const sameAmount = (a, b) => moneyToCents(a) === moneyToCents(b);
const isPaid = (payment) => ['VERIFIED', 'COMPLETED'].includes(payment.status);
const assertMobilePayment = (payment) => {
  if (!payment || payment.method !== 'MOBILE_MONEY' || payment.provider !== 'MBIYOPAY') {
    throw new AppError('MbiyoPay payment record not found', 404);
  }
};

const ensurePaymentMatchesParcel = (parcel, payment) => {
  assertMobilePayment(payment);
  if (payment.parcelId !== parcel.id || !sameAmount(payment.amount, parcel.amount) || payment.currency !== parcel.currency) {
    throw new AppError('Parcel payment does not match the registered amount and currency', 409);
  }
  const expectedAgencyId = parcel.paymentTiming === 'AT_PICKUP' ? parcel.destinationAgencyId : parcel.originAgencyId;
  if (!expectedAgencyId || payment.agencyId !== expectedAgencyId) throw new AppError('Parcel payment agency does not match its payment timing', 409);
};

const initiatePayment = async (payment, details) => {
  try {
    mbiyoPayProvider.assertConfigured();
    mbiyoPayProvider.validatePaymentContext({
      amount: payment.amount, currency: payment.currency, reference: payment.id,
      network: details.network, phoneNumber: details.phoneNumber,
    });
  } catch (error) {
    throw new AppError(error.statusCode === 503 ? 'MbiyoPay is not configured for payment initiation' : error.message, error.statusCode || 400);
  }
  if (payment.status !== 'PENDING') {
    if (['PROCESSING', 'VERIFIED', 'COMPLETED'].includes(payment.status)) throw new AppError('Payment is already being processed or completed', 409);
    throw new AppError('Only pending Mobile Money payments can be initiated', 409);
  }
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: 'PENDING', method: 'MOBILE_MONEY', provider: 'MBIYOPAY' },
    data: { status: 'PROCESSING', channel: 'ONLINE' },
  });
  if (claimed.count !== 1) throw new AppError('Payment initiation is already in progress', 409);

  try {
    const response = await mbiyoPayProvider.initiatePayment({
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.id,
      network: details.network,
      phoneNumber: details.phoneNumber,
    });
    const changed = await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PROCESSING', provider: 'MBIYOPAY' },
      data: {
        status: 'PROCESSING',
        providerTransactionId: response.providerTransactionId,
        providerReference: response.providerReference,
        reference: response.providerReference,
        comment: 'MbiyoPay Mobile Money initiated; waiting for provider confirmation',
      },
    });
    if (changed.count !== 1) throw new AppError('Payment state changed while MbiyoPay was initiating the transaction', 409);
    return {
      paymentId: payment.id,
      status: 'PROCESSING',
      providerTransactionId: response.providerTransactionId,
      reference: response.providerReference,
      currency: payment.currency,
      amount: String(payment.amount),
      checkoutUrl: response.checkoutUrl,
      instructions: response.instructions,
      authMode: response.authMode,
    };
  } catch (error) {
    // A timeout or 5xx may have reached the provider. Keep PROCESSING to prevent a duplicate charge.
    if (error.providerStatus === 'failed' || (Number(error.httpStatus) >= 400 && Number(error.httpStatus) < 500)) {
      await prisma.payment.updateMany({
        where: { id: payment.id, status: 'PROCESSING' },
        data: {
          status: 'FAILED',
          ...(error.providerTransactionId ? { providerTransactionId: error.providerTransactionId } : {}),
          comment: 'MbiyoPay rejected the transaction; no payment was confirmed',
        },
      });
      throw new AppError('MbiyoPay rejected the payment initiation', 422);
    }
    throw new AppError('MbiyoPay response is uncertain; payment remains pending reconciliation', 503);
  }
};

const initiateParcelPayment = async (parcelId, details = {}, currentUser) => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  if (currentUser.role !== 'SUPER_ADMIN' && currentUser.department?.type !== 'VANGUARD_COACH') throw new AppError('Access denied', 403);
  if (!currentUser.permissions?.includes('VERIFY_PARCEL_PAYMENT')) throw new AppError('Insufficient permissions', 403);
  const parcel = await prisma.parcel.findUnique({ where: { id: parcelId }, include: { payments: true } });
  if (!parcel) throw new AppError('Parcel not found', 404);
  const action = parcel.paymentTiming === 'AT_PICKUP' ? 'destination' : 'origin';
  if (['AGENT', 'MANAGER'].includes(currentUser.role)) {
    const agencyId = getUserAgencyId(currentUser);
    if (!agencyId) throw new AppError('An agency assignment is required', 403);
    assertAgencyAccess(currentUser, action === 'destination' ? parcel.destinationAgencyId : parcel.originAgencyId);
  }
  const coachDepartment = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' } });
  if (!coachDepartment) throw new AppError('Vanguard Coach department is not configured', 404);
  await assertDepartmentIdForUser(currentUser, coachDepartment.id, 'VANGUARD_COACH');
  if (parcel.paymentTiming === 'AT_PICKUP' && parcel.status !== 'READY_FOR_PICKUP') {
    throw new AppError('Payment at pickup can only start when the parcel is ready for pickup', 409);
  }
  if (parcel.paymentTiming === 'AT_DEPOSIT' && parcel.status !== 'PAYMENT_PENDING') {
    throw new AppError('Deposit payment can only start while the parcel payment is pending', 409);
  }
  const payments = parcel.payments || await prisma.payment.findMany({ where: { parcelId } });
  if (payments.length !== 1) throw new AppError('Parcel must have exactly one payment record', 409);
  const payment = payments[0];
  ensurePaymentMatchesParcel(parcel, payment);
  const expectedAgencyId = parcel.paymentTiming === 'AT_PICKUP' ? parcel.destinationAgencyId : parcel.originAgencyId;
  if (payment.agencyId !== expectedAgencyId) throw new AppError('Parcel payment agency is inconsistent', 409);
  return initiatePayment(payment, details);
};

const initiatePublicReservationPayment = async (reservationCode, details = {}) => {
  const code = String(reservationCode || '').trim();
  const phone = String(details.customerPhone || '').replace(/[\s()-]/g, '');
  if (!code || !phone) throw new AppError('Reservation code and customer phone are required', 400);
  const reservation = await prisma.reservation.findUnique({
    where: { reservationCode: code },
    include: { payments: true, trip: { include: { schedule: true } } },
  });
  // Do not reveal whether the code or the phone number was the mismatch.
  if (!reservation || String(reservation.customerPhone).replace(/[\s()-]/g, '') !== phone) throw new AppError('Reservation not found', 404);
  if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) throw new AppError('Reservation is not payable', 409);
  const coachDepartment = await prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' }, select: { id: true } });
  if (!reservation.trip?.schedule || !coachDepartment || reservation.trip.schedule.departmentId !== coachDepartment.id) {
    throw new AppError('MbiyoPay public checkout is only available for Vanguard Coach reservations', 403);
  }
  const matches = reservation.payments.filter((payment) => payment.method === 'MOBILE_MONEY' && payment.provider === 'MBIYOPAY');
  if (matches.length !== 1) throw new AppError('No unique MbiyoPay payment exists for this reservation', 409);
  const payment = matches[0];
  if (payment.reservationId !== reservation.id || !sameAmount(payment.amount, reservation.totalAmount)) {
    throw new AppError('Reservation payment does not match its registered amount and currency', 409);
  }
  if (reservation.payments.some((other) => other.id !== payment.id && isPaid(other))) {
    throw new AppError('Reservation balance has already been paid', 409);
  }
  return initiatePayment(payment, { network: details.network, phoneNumber: reservation.customerPhone });
};

const reconcileEvent = async (event) => {
  if (event.type !== 'cashin') throw new AppError('Unsupported MbiyoPay transaction type', 400);
  const payment = await prisma.payment.findFirst({
    where: {
      provider: 'MBIYOPAY',
      providerTransactionId: event.providerTransactionId,
      providerReference: event.providerReference,
      method: 'MOBILE_MONEY',
    },
    include: { parcel: true, reservation: { include: { payments: true } } },
  });
  if (!payment) throw new AppError('MbiyoPay transaction is not associated with a pending internal payment', 404);
  if (payment.status === 'VERIFIED' || payment.status === 'COMPLETED') return { duplicate: true, paymentId: payment.id };
  if (payment.status !== 'PROCESSING') throw new AppError('Internal payment is not awaiting MbiyoPay confirmation', 409);
  if (!sameAmount(payment.amount, event.amount) || payment.currency !== event.currency || payment.providerReference !== event.providerReference) {
    throw new AppError('Webhook amount, currency, or reference does not match the internal payment', 409);
  }

  // A signed notification is only a prompt to verify with MbiyoPay; it is never proof of payment.
  const verification = await mbiyoPayProvider.verifyPayment({
    providerTransactionId: event.providerTransactionId,
    reference: payment.providerReference,
  });
  if (verification.providerTransactionId !== event.providerTransactionId || verification.reference !== payment.providerReference ||
      !sameAmount(verification.amount, payment.amount) || verification.currency !== payment.currency || verification.status !== event.status) {
    throw new AppError('MbiyoPay verification does not match the internal payment', 409);
  }

  if (verification.status === 'pending') return { pending: true, paymentId: payment.id };
  const mappedStatus = verification.status === 'successful' ? 'VERIFIED'
    : verification.status === 'failed' ? 'FAILED'
      : verification.status === 'cancelled' ? 'CANCELLED' : null;
  if (!mappedStatus) throw new AppError('MbiyoPay returned an unsupported transaction status', 409);

  if (mappedStatus !== 'VERIFIED') {
    const updated = await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PROCESSING', providerTransactionId: event.providerTransactionId },
      data: { status: mappedStatus, comment: `MbiyoPay transaction ${verification.status}` },
    });
    if (updated.count !== 1) throw new AppError('Payment was processed concurrently', 409);
    return { paymentId: payment.id, status: mappedStatus };
  }

  let ticketCreated = null;
  await prisma.$transaction(async (tx) => {
    const current = await tx.payment.findUnique({ where: { id: payment.id } });
    if (!current || current.status !== 'PROCESSING' || current.providerTransactionId !== event.providerTransactionId) {
      throw new AppError('Payment was processed concurrently', 409);
    }
    const changed = await tx.payment.updateMany({
      where: { id: payment.id, status: 'PROCESSING', providerTransactionId: event.providerTransactionId },
      data: { status: 'VERIFIED', validatedAt: verification.paidAt && !Number.isNaN(verification.paidAt.getTime()) ? verification.paidAt : new Date(), channel: 'ONLINE', comment: 'Confirmed by MbiyoPay status verification' },
    });
    if (changed.count !== 1) throw new AppError('Payment was processed concurrently', 409);

    if (payment.parcelId) {
      const parcel = await tx.parcel.findUnique({ where: { id: payment.parcelId } });
      if (!parcel || !sameAmount(current.amount, parcel.amount) || current.currency !== parcel.currency || parcel.paymentTiming !== (parcel.status === 'PAYMENT_PENDING' ? 'AT_DEPOSIT' : 'AT_PICKUP')) {
        throw new AppError('Parcel payment no longer matches its internal due state', 409);
      }
      if (parcel.paymentTiming === 'AT_DEPOSIT') {
        const updatedParcel = await tx.parcel.updateMany({ where: { id: parcel.id, status: 'PAYMENT_PENDING' }, data: { status: 'PAID' } });
        if (updatedParcel.count !== 1) throw new AppError('Parcel payment state changed concurrently', 409);
      } else if (parcel.status !== 'READY_FOR_PICKUP') {
        throw new AppError('Parcel is not ready for its pickup payment', 409);
      }
      await tx.parcelStatusHistory.create({ data: {
        parcelId: parcel.id,
        previousStatus: parcel.status,
        newStatus: parcel.paymentTiming === 'AT_DEPOSIT' ? 'PAID' : parcel.status,
        reason: 'MbiyoPay payment verified against provider transaction status',
        details: { action: 'MOBILE_MONEY_PAYMENT_VERIFIED', paymentId: payment.id, provider: 'MBIYOPAY', agencyId: current.agencyId },
      } });
    } else if (payment.reservationId) {
      const reservation = await tx.reservation.findUnique({ where: { id: payment.reservationId }, include: { payments: true, trip: { include: { schedule: true } }, tickets: true } });
      if (!reservation || !['PENDING', 'CONFIRMED'].includes(reservation.status) || !sameAmount(current.amount, reservation.totalAmount)) {
        throw new AppError('Reservation payment no longer matches its registered amount, currency, or state', 409);
      }
      const totalPaidCents = reservation.payments.reduce((sum, row) => {
        if (!isPaid(row) && row.id !== current.id) return sum;
        if (row.currency !== current.currency) throw new AppError('Reservation contains payments in inconsistent currencies', 409);
        return sum + moneyToCents(row.amount);
      }, 0);
      const dueCents = moneyToCents(reservation.totalAmount);
      if (totalPaidCents > dueCents) throw new AppError('Reservation payments exceed the due amount', 409);
      if (totalPaidCents === dueCents) {
        if (reservation.status === 'PENDING') await tx.reservation.update({ where: { id: reservation.id }, data: { status: 'CONFIRMED' } });
        if (!reservation.tickets.length) ticketCreated = await ticketService.createTicketForMobilePaymentInTransaction(tx, reservation.id);
      }
    } else {
      throw new AppError('Payment is not linked to a supported internal resource', 409);
    }
  }, { isolationLevel: 'Serializable' });

  if (ticketCreated?.created && ticketCreated.ticket) await ticketService.notifyCustomerAboutTicket(ticketCreated.ticket);
  return { paymentId: payment.id, status: 'VERIFIED', ticketCreated: Boolean(ticketCreated?.created) };
};

const handleWebhook = async (req) => {
  const signature = req.get('Signature');
  if (!mbiyoPayProvider.verifyWebhookSignature({ payload: req.body, signature })) throw new AppError('Invalid MbiyoPay signature', 401);
  const event = mbiyoPayProvider.parseWebhookEvent(req);
  if (!event) throw new AppError('Invalid MbiyoPay webhook payload', 400);
  return reconcileEvent(event);
};

module.exports = { initiateParcelPayment, initiatePublicReservationPayment, handleWebhook, reconcileEvent };
