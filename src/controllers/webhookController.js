const prisma = require('../config/prisma');
const auditService = require('../services/auditService');
const { mbiyoPayProvider } = require('../services/payment');

const parseRequestPayload = (req) => {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.rawBody === 'string' && req.rawBody.trim()) return req.rawBody;
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return '';
};

const maybeGenerateTicket = async (tx, reservationId) => {
  const existing = await tx.ticket.findUnique({ where: { reservationId } });
  if (existing) return existing;

  const ticketCode = `TCK-${require('crypto').randomUUID()}`;
  return tx.ticket.create({
    data: {
      ticketCode,
      reservationId,
      serialNumber: `SN-${Date.now()}-${require('crypto').randomInt(10000, 99999)}`,
      qrCode: `vanguard://ticket/${ticketCode}`,
      status: 'VALID',
    },
  });
};

const handleMbiyoPayWebhook = async (req, res, next) => {
  try {
    if (!mbiyoPayProvider.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'MbiyoPay webhook provider is not configured',
      });
    }

    const signature = ['x-mbiyopay-signature', 'x-signature', 'signature']
      .map((key) => req.headers?.[key])
      .find(Boolean) || '';
    const rawPayload = parseRequestPayload(req);

    if (!signature) {
      return res.status(401).json({ success: false, message: 'Missing webhook signature' });
    }

    const isValid = mbiyoPayProvider.verifyWebhookSignature({
      payload: rawPayload,
      signature,
    });
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = mbiyoPayProvider.parseWebhookEvent(req);
    if (!event.providerTransactionId && !event.providerReference) {
      return res.status(400).json({ success: false, message: 'Missing transaction identifier' });
    }

    if (event.status === 'PENDING') {
      return res.json({ success: true, data: { status: 'ACKNOWLEDGED' } });
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: {
          OR: [
            { providerTransactionId: event.providerTransactionId },
            { providerReference: event.providerReference },
            { reference: event.providerReference },
          ],
        },
        include: { reservation: { include: { payments: true } } },
      });

      if (!payment) {
        return { status: 'IGNORED', message: 'Transaction not found' };
      }

      if (payment.status === 'VERIFIED' || payment.status === 'COMPLETED') {
        return { status: 'ALREADY_PROCESSED', paymentId: payment.id };
      }

      if (event.amount != null && Number(payment.amount) !== Number(event.amount)) {
        return { status: 'AMOUNT_MISMATCH', paymentId: payment.id };
      }

      if (event.currency && String(payment.currency || 'USD').toUpperCase() !== String(event.currency).toUpperCase()) {
        return { status: 'CURRENCY_MISMATCH', paymentId: payment.id };
      }

      const providerStatus = await mbiyoPayProvider.verifyPayment({
        providerTransactionId: event.providerTransactionId,
        reference: event.providerReference,
      });
      if (!providerStatus || providerStatus.status !== 'VERIFIED') {
        return { status: 'NOT_CONFIRMED', paymentId: payment.id, providerStatus };
      }

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'VERIFIED',
          providerTransactionId: event.providerTransactionId || payment.providerTransactionId,
          providerReference: event.providerReference || payment.providerReference,
          currency: event.currency || payment.currency || 'USD',
          validatedAt: new Date(),
        },
      });

      if (payment.reservationId) {
        const reservation = await tx.reservation.findUnique({
          where: { id: payment.reservationId },
          include: { payments: true },
        });

        if (reservation && reservation.status === 'PENDING') {
          const totalRequiredCents = Number(reservation.totalAmount || 0) * 100;
          const totalVerifiedCents = reservation.payments
            .filter((reservationPayment) => ['VERIFIED', 'COMPLETED'].includes(reservationPayment.status))
            .reduce((sum, reservationPayment) => sum + Number(reservationPayment.amount || 0) * 100, 0);
          const candidateTotal = totalVerifiedCents + Number(updatedPayment.amount || 0) * 100;

          if (candidateTotal >= totalRequiredCents) {
            await tx.reservation.update({
              where: { id: reservation.id },
              data: { status: 'CONFIRMED' },
            });
            await maybeGenerateTicket(tx, reservation.id);
          }
        }
      }

      return { status: 'PROCESSED', paymentId: payment.id };
    });

    await auditService.log('webhook_mbiyopay_received', null, {
      eventType: event.eventType,
      providerTransactionId: event.providerTransactionId,
      providerReference: event.providerReference,
      amount: event.amount,
      currency: event.currency,
      paymentStatus: event.status,
      resultStatus: result.status,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  handleMbiyoPayWebhook,
};

