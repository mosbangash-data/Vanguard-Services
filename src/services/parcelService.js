const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { applyPricingBasis } = require('./parcelPricingService');
const { encryptSensitiveData, decryptSensitiveData, maskIdNumber, generateSecureTrackingCode } = require('../utils/cryptoUtils');
const { buildSignedQrPayload } = require('../utils/qrUtils');
const QRCode = require('qrcode');

const PARCEL_RECEIPT_FORMATS = ['a4', '58mm', '80mm', '110mm'];
const normalizeParcelReceiptFormat = (format = 'a4') => {
  const normalized = String(format).toLowerCase();
  if (!PARCEL_RECEIPT_FORMATS.includes(normalized)) {
    throw new AppError('Receipt format must be one of: a4, 58mm, 80mm, 110mm', 400);
  }
  return normalized;
};

const ALLOWED_PARCEL_TRANSITIONS = {
  REGISTERED: ['ACCEPTED', 'CANCELLED'],
  PAYMENT_PENDING: ['CANCELLED'],
  PAID: ['ACCEPTED', 'CANCELLED', 'RETURNED'],
  ACCEPTED: ['IN_TRANSIT', 'CANCELLED', 'RETURNED'],
  IN_TRANSIT: ['ARRIVED_AT_AGENCY', 'RETURNED'],
  ARRIVED_AT_AGENCY: ['READY_FOR_PICKUP', 'RETURNED'],
  READY_FOR_PICKUP: ['RETURNED'],
  COLLECTED: [],
  RETURNED: [],
  CANCELLED: [],
};

const assertCoachAccess = (currentUser) => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  if (currentUser.role !== 'SUPER_ADMIN' && currentUser.department?.type !== 'VANGUARD_COACH') {
    throw new AppError('Access denied', 403);
  }
};

const resolveOriginAgencyId = (requestedAgencyId, currentUser) => {
  const assignedAgencyId = currentUser?.agencyId || currentUser?.agency?.id || null;
  if (['AGENT', 'MANAGER'].includes(currentUser?.role) && !assignedAgencyId) {
    throw new AppError(`${currentUser.role === 'MANAGER' ? 'Manager' : 'Agent'} agency assignment is required`, 403);
  }
  if (assignedAgencyId && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'SERVICE_ADMIN') {
    if (requestedAgencyId && requestedAgencyId !== assignedAgencyId) {
      throw new AppError('Access denied: You cannot register a parcel for another origin agency', 403);
    }
    return assignedAgencyId;
  }
  return requestedAgencyId || null;
};

const resolvePricingDimensions = (basis, weightKg, volumeM3) => {
  const normalizedBasis = basis ? String(basis).toUpperCase() : null;
  if (normalizedBasis && !['WEIGHT', 'VOLUME'].includes(normalizedBasis)) {
    throw new AppError('pricingBasis must be WEIGHT or VOLUME', 400);
  }
  if (normalizedBasis === 'WEIGHT' && !(Number(weightKg) > 0)) {
    throw new AppError('A positive weight is required for weight-based pricing', 400);
  }
  if (normalizedBasis === 'VOLUME' && !(Number(volumeM3) > 0)) {
    throw new AppError('A positive volume is required for volume-based pricing', 400);
  }
  return applyPricingBasis(normalizedBasis, weightKg, volumeM3);
};

const resolveManualParcelPrice = (value, currencyValue, defaultCurrency = 'USD') => {
  const raw = typeof value === 'number' ? String(value) : String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw new AppError('A valid parcel price with at most two decimal places is required', 400);
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999.99) {
    throw new AppError('Parcel price must be greater than zero and within the supported limit', 400);
  }
  const currency = String(currencyValue || defaultCurrency || 'USD').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new AppError('A valid three-letter parcel currency is required', 400);
  return { amount: amount.toFixed(2), currency };
};

const assertParcelAgencyAccess = (currentUser, parcel, action = 'view') => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'SERVICE_ADMIN') {
    return;
  }

  const userAgencyId = currentUser.agencyId || currentUser.agency?.id;
  if (!userAgencyId) {
    if (['AGENT', 'MANAGER'].includes(currentUser.role)) {
      throw new AppError(`${currentUser.role === 'MANAGER' ? 'Manager' : 'Agent'} agency assignment is required`, 403);
    }
    return;
  }

  if (action === 'collect' || action === 'arrival' || action === 'destination') {
    if (!parcel.destinationAgencyId || parcel.destinationAgencyId !== userAgencyId) {
      throw new AppError('Access denied: You can only perform this action for parcels assigned to your destination agency', 403);
    }
  } else if (action === 'origin' || action === 'create' || action === 'depart') {
    if (!parcel.originAgencyId || parcel.originAgencyId !== userAgencyId) {
      throw new AppError('Access denied: You can only perform this action for parcels originating from your agency', 403);
    }
  } else {
    const isOrigin = parcel.originAgencyId && parcel.originAgencyId === userAgencyId;
    const isDestination = parcel.destinationAgencyId && parcel.destinationAgencyId === userAgencyId;
    if ((!parcel.originAgencyId && !parcel.destinationAgencyId) || (!isOrigin && !isDestination)) {
      throw new AppError('Access denied: Parcel does not belong to your agency', 403);
    }
  }
};

const getCoachDepartment = async () => {
  return prisma.department.findUnique({ where: { type: 'VANGUARD_COACH' }, include: { settings: true } });
};

const listParcels = async (query = {}, currentUser) => {
  assertCoachAccess(currentUser);
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Math.min(Number(query.limit), 100) : 20;
  const skip = (page - 1) * limit;

  const where = {};
  const filters = [];
  if (query.trackingCode) where.trackingCode = { contains: String(query.trackingCode).trim(), mode: 'insensitive' };
  if (query.status) where.status = query.status;
  if (query.destinationAgencyId) where.destinationAgencyId = String(query.destinationAgencyId).trim();
  if (query.paymentStatus) {
    if (!['PENDING', 'VERIFIED', 'COMPLETED'].includes(String(query.paymentStatus).toUpperCase())) throw new AppError('Invalid parcel payment status filter', 400);
    where.payments = { some: { status: String(query.paymentStatus).toUpperCase(), method: 'CASH' } };
  }
  if (query.createdFrom || query.createdTo) {
    const from = query.createdFrom ? new Date(query.createdFrom) : null;
    const to = query.createdTo ? new Date(query.createdTo) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) throw new AppError('Invalid parcel date range', 400);
    where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  }
  const search = String(query.search || '').trim().replace(/\s+/g, ' ');
  if (search) filters.push({ OR: [
    { trackingCode: { contains: search, mode: 'insensitive' } },
    { senderName: { contains: search, mode: 'insensitive' } },
    { recipientName: { contains: search, mode: 'insensitive' } },
    { senderPhone: { contains: search } },
    { recipientPhone: { contains: search } },
  ] });
  if (query.originCity) where.originCity = { contains: String(query.originCity).trim(), mode: 'insensitive' };
  if (query.destinationCity) where.destinationCity = { contains: String(query.destinationCity).trim(), mode: 'insensitive' };
  if (query.senderPhone) where.senderPhone = { contains: String(query.senderPhone).trim() };
  if (query.recipientPhone) where.recipientPhone = { contains: String(query.recipientPhone).trim() };

  // Agency isolation for local agents
  const userAgencyId = currentUser.agencyId || currentUser.agency?.id;
  if (['AGENT', 'MANAGER'].includes(currentUser.role) && !userAgencyId) {
    throw new AppError(`${currentUser.role === 'MANAGER' ? 'Manager' : 'Agent'} agency assignment is required`, 403);
  }
  if (userAgencyId && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'SERVICE_ADMIN') {
    filters.push({ OR: [
      { originAgencyId: userAgencyId },
      { destinationAgencyId: userAgencyId },
    ] });
  }
  if (filters.length) where.AND = filters;

  const [items, total] = await Promise.all([
    prisma.parcel.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        originAgency: true,
        destinationAgency: true,
        receivedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        pickup: {
          select: {
            id: true,
            collectorName: true,
            collectorPhone: true,
            idType: true,
            idNumberMasked: true,
            pickedUpAt: true,
            pickedUpBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        payments: { where: { method: 'CASH' } },
      },
    }),
    prisma.parcel.count({ where }),
  ]);

  return { items, page, limit, total };
};

const getParcelById = async (id, currentUser) => {
  assertCoachAccess(currentUser);
  const parcel = await prisma.parcel.findUnique({
    where: { id },
    include: {
      originAgency: true,
      destinationAgency: true,
      receivedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      pickup: {
        select: {
          id: true,
          collectorName: true,
          collectorPhone: true,
          idType: true,
          idNumberMasked: true,
          pickedUpAt: true,
          notes: true,
          pickedUpBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      statusHistory: {
        orderBy: { changedAt: 'asc' },
        include: {
          changedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      payments: { where: { method: 'CASH' } },
    },
  });

  if (!parcel) throw new AppError('Parcel not found', 404);
  assertParcelAgencyAccess(currentUser, parcel, 'view');
  return { parcel };
};

const createParcel = async (data, currentUser) => {
  assertCoachAccess(currentUser);
  const pricingBasis = data.pricingBasis ? String(data.pricingBasis).toUpperCase() : null;
  const dept = await getCoachDepartment();
  if (!dept) throw new AppError('Vanguard Coach department is not configured', 500);
  const pricingDimensions = resolvePricingDimensions(pricingBasis, data.weightKg, data.volumeM3);
  const manualPrice = resolveManualParcelPrice(data.amount, data.currency, dept.settings?.currency);
  const paymentTiming = String(data.paymentTiming || '').toUpperCase();
  if (!['AT_DEPOSIT', 'AT_PICKUP'].includes(paymentTiming)) throw new AppError('A parcel payment timing is required', 400);
  if (paymentTiming === 'AT_DEPOSIT' && data.cashCollected !== true) throw new AppError('Confirm that CASH was actually collected at deposit', 400);
  if (paymentTiming === 'AT_PICKUP' && data.cashCollected === true) throw new AppError('Cash collected at deposit conflicts with payment due at pickup', 400);
  if (data.paymentMethod && String(data.paymentMethod).toUpperCase() !== 'CASH') throw new AppError('Only CASH payments are supported for parcels', 400);
  data.originAgencyId = resolveOriginAgencyId(data.originAgencyId, currentUser);

  if (data.originAgencyId) {
    const originAgency = await prisma.agency.findUnique({ where: { id: data.originAgencyId } });
    if (!originAgency || !originAgency.isActive) {
      throw new AppError('Origin agency not found or inactive', 400);
    }
    if (originAgency.departmentId !== dept.id) throw new AppError('Origin agency must belong to Vanguard Coach', 400);
    if (!data.originCity && originAgency.city) {
      data.originCity = originAgency.city;
    }
  }

  if (data.destinationAgencyId) {
    const destinationAgency = await prisma.agency.findUnique({ where: { id: data.destinationAgencyId } });
    if (!destinationAgency || !destinationAgency.isActive) {
      throw new AppError('Destination agency not found or inactive', 400);
    }
    if (destinationAgency.departmentId !== dept.id) throw new AppError('Destination agency must belong to Vanguard Coach', 400);
    if (!data.destinationCity && destinationAgency.city) {
      data.destinationCity = destinationAgency.city;
    }
  }

  if (data.originAgencyId && data.destinationAgencyId && data.originAgencyId === data.destinationAgencyId) {
    throw new AppError('Origin agency and destination agency cannot be the same', 400);
  }

  if (!data.senderName || !data.senderPhone || !data.recipientName || !data.recipientPhone || !data.originCity || !data.destinationCity) {
    throw new AppError('Sender, recipient, and route (origin/destination) information are required', 400);
  }

  const trackingCode = generateSecureTrackingCode();
  const initialStatus = 'REGISTERED';

  const parcel = await prisma.$transaction(async (tx) => {
    const created = await tx.parcel.create({
      data: {
        trackingCode,
        senderName: String(data.senderName).trim(),
        senderPhone: String(data.senderPhone).trim(),
        senderEmail: data.senderEmail ? String(data.senderEmail).trim() : null,
        recipientName: String(data.recipientName).trim(),
        recipientPhone: String(data.recipientPhone).trim(),
        recipientEmail: data.recipientEmail ? String(data.recipientEmail).trim() : null,
        originCity: String(data.originCity).trim(),
        destinationCity: String(data.destinationCity).trim(),
        originAgencyId: data.originAgencyId || null,
        destinationAgencyId: data.destinationAgencyId || null,
        category: data.category ? String(data.category).trim().toUpperCase() : 'STANDARD',
        ...pricingDimensions,
        declaredValue: data.declaredValue ? Number(data.declaredValue) : null,
        amount: manualPrice.amount,
        currency: manualPrice.currency,
        paymentTiming,
        status: initialStatus,
        receivedByUserId: null,
        receivedAt: null,
      },
      include: {
        originAgency: true,
        destinationAgency: true,
        payments: true,
      },
    });

    const payment = await tx.payment.create({
        data: {
          parcelId: created.id,
          agencyId: created.originAgencyId || null,
          amount: created.amount,
          currency: created.currency,
          channel: 'AGENCY',
          method: 'CASH',
          status: paymentTiming === 'AT_DEPOSIT' ? 'VERIFIED' : 'PENDING',
          provider: 'CASH',
          comment: paymentTiming === 'AT_DEPOSIT' ? 'Cash collected at parcel deposit' : 'Cash due at parcel pickup',
          validatedById: paymentTiming === 'AT_DEPOSIT' ? currentUser?.id : null,
          validatedAt: paymentTiming === 'AT_DEPOSIT' ? new Date() : null,
        },
      });

    await tx.parcelStatusHistory.create({
      data: {
        parcelId: created.id,
        previousStatus: null,
        newStatus: initialStatus,
        changedByUserId: currentUser?.id || null,
        reason: 'Initial parcel registration and physical reception',
        details: { action: 'REGISTERED', pricingBasis: pricingBasis || null, paymentMethod: 'CASH', paymentTiming, financialStatus: payment.status, paymentId: payment.id, agencyId: created.originAgencyId || null },
      },
    });

    return created;
  });

  await auditService.log('create_parcel', currentUser?.id || null, {
    targetParcelId: parcel.id,
    trackingCode: parcel.trackingCode,
    amount: parcel.amount,
    currency: parcel.currency,
  });

  return { parcel };
};

const payParcel = async (id, paymentData = {}, currentUser) => {
  assertCoachAccess(currentUser);
  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) throw new AppError('Parcel not found', 404);
  assertParcelAgencyAccess(currentUser, parcel, 'destination');
  if (parcel.paymentTiming !== 'AT_PICKUP' || parcel.status !== 'READY_FOR_PICKUP') {
    throw new AppError('CASH payment is only due at the destination when the parcel is ready for pickup', 409);
  }
  const method = String(paymentData.method || 'CASH').toUpperCase();
  if (method !== 'CASH') throw new AppError('Only CASH payments are supported for parcels', 400);
  const channel = 'AGENCY';
  const result = await prisma.$transaction(async (tx) => {
    const cashPayments = await tx.payment.findMany({ where: { parcelId: id } });
    const pending = cashPayments.filter((payment) => payment.status === 'PENDING');
    if (cashPayments.length !== 1 || cashPayments[0].method !== 'CASH' || pending.length !== 1) throw new AppError(pending.length ? 'Parcel payment state is inconsistent and requires review' : 'Parcel has no unpaid CASH payment', 409);
    if (Number(pending[0].amount).toFixed(2) !== Number(parcel.amount).toFixed(2) || pending[0].currency !== parcel.currency) {
      throw new AppError('Pending CASH payment does not match the parcel amount', 409);
    }
    const updated = await tx.payment.updateMany({
      where: { id: pending[0].id, status: 'PENDING', method: 'CASH', amount: pending[0].amount, currency: parcel.currency },
      data: { status: 'VERIFIED', validatedById: currentUser.id, validatedAt: new Date(), comment: paymentData.comment ? String(paymentData.comment).trim() : 'Cash collected at agency' },
    });
    if (updated.count !== 1) throw new AppError('Parcel payment was already collected', 409);
    const payment = await tx.payment.findUnique({ where: { id: pending[0].id } });
    await tx.parcelStatusHistory.create({ data: {
      parcelId: id,
      previousStatus: parcel.status,
      newStatus: parcel.status,
      changedByUserId: currentUser.id,
      reason: 'Parcel CASH payment collected',
      details: { action: 'CASH_PAYMENT_COLLECTED', paymentId: payment.id, previousPaymentStatus: 'PENDING', newPaymentStatus: 'VERIFIED', amount: payment.amount, agencyId: parcel.destinationAgencyId },
    } });
    return { payment, newStatus: parcel.status };
  });

  await auditService.log('pay_parcel', currentUser?.id || null, {
    targetParcelId: parcel.id,
    paymentId: result.payment.id,
    channel,
    method,
    amount: parcel.amount,
    status: result.payment.status,
  });

  return { payment: result.payment, parcelStatus: result.newStatus };
};

const changeParcelStatus = async (id, { newStatus, reason } = {}, currentUser, dedicatedReceipt = false) => {
  assertCoachAccess(currentUser);
  if (!newStatus) throw new AppError('newStatus is required', 400);
  if (['PAYMENT_PENDING', 'PAID'].includes(newStatus)) {
    throw new AppError('Parcel financial state is managed only by the CASH payment action', 400);
  }
  if (['COLLECTED', 'DELIVERED'].includes(newStatus) || (newStatus === 'ARRIVED_AT_AGENCY' && !dedicatedReceipt)) {
    throw new AppError('Parcel receipt and handover must use their dedicated confirmation actions', 400);
  }

  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) throw new AppError('Parcel not found', 404);

  const isOriginAction = ['ACCEPTED', 'IN_TRANSIT'].includes(newStatus);
  const isDestinationAction = ['ARRIVED_AT_AGENCY', 'READY_FOR_PICKUP'].includes(newStatus);
  if (isOriginAction) {
    assertParcelAgencyAccess(currentUser, parcel, 'origin');
  } else if (isDestinationAction) {
    assertParcelAgencyAccess(currentUser, parcel, 'destination');
  } else {
    assertParcelAgencyAccess(currentUser, parcel, 'view');
  }

  const allowed = ALLOWED_PARCEL_TRANSITIONS[parcel.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(`Invalid status transition from ${parcel.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`, 400);
  }
  const eventAgencyId = ['ACCEPTED', 'IN_TRANSIT'].includes(newStatus)
    ? parcel.originAgencyId
    : ['ARRIVED_AT_AGENCY', 'READY_FOR_PICKUP'].includes(newStatus)
      ? parcel.destinationAgencyId
      : currentUser.agencyId || currentUser.agency?.id || null;
  const updated = await prisma.$transaction(async (tx) => {
    const count = await tx.parcel.updateMany({
      where: { id, status: parcel.status },
      data: {
        status: newStatus,
        ...(newStatus === 'ARRIVED_AT_AGENCY' ? { receivedAt: new Date(), receivedByUserId: currentUser.id } : {}),
      },
    });
    if (count.count !== 1) {
      throw new AppError('Concurrent status modification detected, please refresh', 409);
    }

    await tx.parcelStatusHistory.create({
      data: {
        parcelId: id,
        previousStatus: parcel.status,
        newStatus,
        changedByUserId: currentUser?.id || null,
        reason: reason ? String(reason).trim() : `Status updated to ${newStatus}`,
        details: { action: newStatus === 'ARRIVED_AT_AGENCY' ? 'DESTINATION_RECEIPT_CONFIRMED' : 'STATUS_TRANSITION', agencyId: eventAgencyId },
      },
    });

    return tx.parcel.findUnique({ where: { id } });
  });

  await auditService.log('change_parcel_status', currentUser?.id || null, {
    targetParcelId: id,
    previousStatus: parcel.status,
    newStatus,
    reason,
  });

  return { parcel: updated };
};

const receiveParcel = async (id, currentUser) => {
  assertCoachAccess(currentUser);
  if (!currentUser.permissions?.includes('RECEIVE_PARCEL')) {
    throw new AppError('Insufficient permissions to confirm destination receipt', 403);
  }
  return changeParcelStatus(id, { newStatus: 'ARRIVED_AT_AGENCY', reason: 'Physical receipt confirmed at destination agency' }, currentUser, true);
};

const collectParcel = async (id, pickupData = {}, currentUser) => {
  assertCoachAccess(currentUser);
  const { collectorName, collectorPhone, idType, idNumber, notes } = pickupData;

  if (!collectorName || !collectorPhone || !idType || !idNumber) {
    throw new AppError('Collector name, phone, ID type and ID number are strictly required for parcel pickup', 400);
  }

  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) throw new AppError('Parcel not found', 404);
  assertParcelAgencyAccess(currentUser, parcel, 'collect');

  if (parcel.status !== 'READY_FOR_PICKUP') {
    throw new AppError(`Parcel cannot be collected in status '${parcel.status}'. It must be READY_FOR_PICKUP`, 409);
  }

  const idNumberEncrypted = encryptSensitiveData(String(idNumber).trim());
  const idNumberMasked = maskIdNumber(String(idNumber).trim());

  const result = await prisma.$transaction(async (tx) => {
    const parcelPayments = await tx.payment.findMany({ where: { parcelId: id } });
    const pendingPayments = parcelPayments.filter((payment) => payment.status === 'PENDING');
    const validatedPayments = parcelPayments.filter((payment) => ['VERIFIED', 'COMPLETED'].includes(payment.status));
    if (parcelPayments.length !== 1 || parcelPayments[0].method !== 'CASH' || pendingPayments.length || validatedPayments.length !== 1) {
      throw new AppError('Parcel must have exactly one confirmed CASH payment before pickup', 409);
    }
    const collectedPayment = validatedPayments[0];
    if (Number(collectedPayment.amount).toFixed(2) !== Number(parcel.amount).toFixed(2) || collectedPayment.currency !== parcel.currency) {
      throw new AppError('Confirmed CASH payment does not match the parcel amount', 409);
    }

    // Atomic update to ensure single pickup after payment confirmation.
    const updateResult = await tx.parcel.updateMany({
      where: {
        id,
        status: 'READY_FOR_PICKUP',
      },
      data: { status: 'COLLECTED' },
    });

    if (updateResult.count !== 1) {
      throw new AppError('Parcel has already been collected or status changed concurrently', 409);
    }

    const pickup = await tx.parcelPickup.create({
      data: {
        parcelId: id,
        collectorName: String(collectorName).trim(),
        collectorPhone: String(collectorPhone).trim(),
        idType: String(idType).trim().toUpperCase(),
        idNumberEncrypted,
        idNumberMasked,
        pickedUpByUserId: currentUser.id,
        pickedUpAt: new Date(),
        notes: notes ? String(notes).trim() : null,
      },
    });

    await tx.parcelStatusHistory.create({
      data: {
        parcelId: id,
        previousStatus: parcel.status,
        newStatus: 'COLLECTED',
        changedByUserId: currentUser.id,
        reason: 'Parcel handed over to the named collector',
        details: { action: 'PARCEL_HANDED_OVER', pickupId: pickup.id, idType, paymentId: collectedPayment.id, financialStatus: 'VERIFIED', agencyId: parcel.destinationAgencyId },
      },
    });

    return { pickup, payment: collectedPayment, parcel: await tx.parcel.findUnique({ where: { id } }) };
  });

  await auditService.log('collect_parcel', currentUser.id, {
    targetParcelId: id,
    pickupId: result.pickup.id,
    paymentId: result.payment.id,
    idType: result.pickup.idType,
    idNumberMasked: result.pickup.idNumberMasked,
  });

  return {
    success: true,
    message: 'Parcel collected successfully',
    parcel: result.parcel,
    pickup: {
      id: result.pickup.id,
      collectorName: result.pickup.collectorName,
      collectorPhone: result.pickup.collectorPhone,
      idType: result.pickup.idType,
      idNumberMasked: result.pickup.idNumberMasked,
      pickedUpAt: result.pickup.pickedUpAt,
    },
  };
};

const getParcelIdentityData = async (id, currentUser) => {
  assertCoachAccess(currentUser);
  if (!currentUser.permissions?.includes('VIEW_IDENTITY_DATA')) {
    throw new AppError('Insufficient permissions to view decrypted sensitive identity data', 403);
  }

  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) throw new AppError('Parcel not found', 404);
  assertParcelAgencyAccess(currentUser, parcel, 'destination');

  const pickup = await prisma.parcelPickup.findUnique({ where: { parcelId: id } });
  if (!pickup) throw new AppError('Pickup record not found for this parcel', 404);

  const decryptedIdNumber = decryptSensitiveData(pickup.idNumberEncrypted);

  await auditService.log('view_sensitive_identity_data', currentUser.id, {
    targetParcelId: id,
    pickupId: pickup.id,
    idType: pickup.idType,
  });

  return {
    collectorName: pickup.collectorName,
    collectorPhone: pickup.collectorPhone,
    idType: pickup.idType,
    idNumber: decryptedIdNumber || pickup.idNumberMasked,
    pickedUpAt: pickup.pickedUpAt,
  };
};

const getParcelReceiptContext = async (id, currentUser, requestedFormat = 'a4') => {
  assertCoachAccess(currentUser);
  const format = normalizeParcelReceiptFormat(requestedFormat);
  const parcel = await prisma.parcel.findUnique({
    where: { id },
    include: {
      originAgency: true,
      destinationAgency: true,
      payments: { where: { method: 'CASH', status: { in: ['VERIFIED', 'COMPLETED', 'PENDING'] } }, take: 1, orderBy: { createdAt: 'desc' } },
      statusHistory: {
        where: { newStatus: 'ARRIVED_AT_AGENCY' },
        orderBy: { changedAt: 'desc' },
        take: 1,
        include: { changedBy: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (!parcel) throw new AppError('Parcel not found', 404);
  assertParcelAgencyAccess(currentUser, parcel, 'view');

  const signedQr = buildSignedQrPayload('parcel', parcel.trackingCode);
  const qrDataUrl = await QRCode.toDataURL(signedQr, { errorCorrectionLevel: 'M', margin: 1, width: format === '58mm' ? 120 : 180 });
  const payment = parcel.payments[0] || null;
  const arrivalEvent = parcel.statusHistory[0] || null;

  return {
    id: parcel.id,
    companyName: 'Vanguard Services',
    trackingCode: parcel.trackingCode,
    qrPayload: signedQr,
    qrDataUrl,
    printFormat: format,
    senderName: parcel.senderName,
    senderPhone: parcel.senderPhone,
    recipientName: parcel.recipientName,
    recipientPhone: parcel.recipientPhone,
    origin: parcel.originAgency?.name ? `${parcel.originCity} (${parcel.originAgency.name})` : parcel.originCity,
    destination: parcel.destinationAgency?.name ? `${parcel.destinationCity} (${parcel.destinationAgency.name})` : parcel.destinationCity,
    category: parcel.category,
    weightKg: Number(parcel.weightKg),
    volumeM3: Number(parcel.volumeM3),
    amount: Number(parcel.amount).toFixed(2),
    currency: parcel.currency,
    paymentStatus: payment && ['VERIFIED', 'COMPLETED'].includes(payment.status) ? 'PAID' : 'PENDING',
    paymentTiming: parcel.paymentTiming,
    paymentDueAtPickup: parcel.paymentTiming === 'AT_PICKUP',
    paymentReference: payment?.reference || payment?.providerTransactionId || 'N/A',
    paidAt: payment?.validatedAt || null,
    status: parcel.status,
    createdAt: parcel.createdAt,
    receivedAt: arrivalEvent?.changedAt || null,
    receivedBy: arrivalEvent?.changedBy ? `${arrivalEvent.changedBy.firstName} ${arrivalEvent.changedBy.lastName}` : null,
  };
};

const trackPublicParcel = async (trackingCode) => {
  if (!trackingCode || typeof trackingCode !== 'string') {
    throw new AppError('Tracking code is required', 400);
  }

  const parcel = await prisma.parcel.findUnique({
    where: { trackingCode: String(trackingCode).trim() },
    select: {
      trackingCode: true,
      originCity: true,
      destinationCity: true,
      status: true,
      category: true,
      createdAt: true,
      statusHistory: {
        orderBy: { changedAt: 'asc' },
        select: { newStatus: true, changedAt: true, reason: true },
      },
    },
  });

  if (!parcel) throw new AppError('Parcel not found with this tracking code', 404);
  return { parcel };
};

const updateParcel = async (id, data, currentUser) => {
  assertCoachAccess(currentUser);
  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) throw new AppError('Parcel not found', 404);
  assertParcelAgencyAccess(currentUser, parcel, 'origin');

  if (parcel.status !== 'REGISTERED') {
    throw new AppError(`Cannot modify details of a parcel in status '${parcel.status}'. Only REGISTERED parcels can be edited.`, 400);
  }

  const allowedFields = ['senderEmail', 'recipientEmail', 'originAgencyId', 'destinationAgencyId'];
  const updateData = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }

  const updated = await prisma.parcel.update({ where: { id }, data: updateData });
  await auditService.log('update_parcel', currentUser.id, { targetParcelId: id, changes: updateData });
  return { parcel: updated };
};

const deleteParcel = async (id, currentUser) => {
  assertCoachAccess(currentUser);
  if (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'SERVICE_ADMIN') {
    throw new AppError('Insufficient permissions to delete parcels', 403);
  }

  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) throw new AppError('Parcel not found', 404);
  assertParcelAgencyAccess(currentUser, parcel, 'origin');

  if (parcel.status !== 'REGISTERED' && parcel.status !== 'CANCELLED') {
    throw new AppError('Only REGISTERED or CANCELLED parcels can be removed', 400);
  }

  await prisma.parcel.delete({ where: { id } });
  await auditService.log('delete_parcel', currentUser.id, { targetParcelId: id });
  return { success: true };
};

module.exports = {
  listParcels,
  getParcelById,
  createParcel,
  payParcel,
  changeParcelStatus,
  receiveParcel,
  collectParcel,
  getParcelIdentityData,
  getParcelReceiptContext,
  trackPublicParcel,
  updateParcel,
  deleteParcel,
  resolveOriginAgencyId,
  resolvePricingDimensions,
  resolveManualParcelPrice,
  normalizeParcelReceiptFormat,
  PARCEL_RECEIPT_FORMATS,
  assertParcelAgencyAccess,
  ALLOWED_PARCEL_TRANSITIONS,
};

