const prisma = require('../config/prisma');
const auditService = require('../services/auditService');
const { mbiyoPayProvider } = require('../services/payment');

const handleMbiyoPayWebhook = async (req, res, next) => {
  try {
    if (!mbiyoPayProvider.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'MbiyoPay webhook provider is not configured',
      });
    }

    const signature = req.headers['x-mbiyopay-signature'] || req.headers['x-signature'] || '';
    const rawPayload = JSON.stringify(req.body);

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

    // Process idempotently in database transaction
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: {
          OR: [
            { providerTransactionId: event.providerTransactionId },
            { providerReference: event.providerReference },
            { reference: event.providerReference },
          ],
        },
        include: { reservation: true, parcel: true },
      });

      if (!payment) {
        return { status: 'IGNORED', message: 'Transaction not found' };
      }

      if (payment.status === 'VERIFIED' || payment.status === 'COMPLETED') {
        return { status: 'ALREADY_PROCESSED', paymentId: payment.id };
      }

      if (event.amount && Number(payment.amount) !== Number(event.amount)) {
        return { status: 'AMOUNT_MISMATCH', paymentId: payment.id };
      }

      if (event.status === 'VERIFIED') {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'VERIFIED',
            validatedAt: new Date(),
          },
        });

        if (payment.reservationId) {
          await tx.reservation.update({
            where: { id: payment.reservationId },
            data: { status: 'CONFIRMED' },
          });
        }

        if (payment.parcelId) {
          await tx.parcel.update({
            where: { id: payment.parcelId },
            data: { status: 'PAID' },
          });
          await tx.parcelStatusHistory.create({
            data: {
              parcelId: payment.parcelId,
              previousStatus: payment.parcel?.status || 'PAYMENT_PENDING',
              newStatus: 'PAID',
              reason: 'Payment confirmed via MbiyoPay webhook',
              details: { providerTransactionId: event.providerTransactionId },
            },
          });
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

