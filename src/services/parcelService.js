const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const { requireDepartmentType } = require('./departmentAccessService');
const { calculateOfficialPrice } = require('./parcelPricingService');
const { encryptSensitiveData, decryptSensitiveData, maskIdNumber, generateSecureTrackingCode } = require('../utils/cryptoUtils');
const { buildSignedQrPayload } = require('../utils/qrUtils');
const { getProvider } = require('./payment');

const ALLOWED_PARCEL_TRANSITIONS = {
  REGISTERED: ['PAYMENT_PENDING', 'PAID', 'CANCELLED'],
  PAYMENT_PENDING: ['PAID', 'CANCELLED'],
  PAID: ['ACCEPTED', 'CANCELLED', 'RETURNED'],
  ACCEPTED: ['IN_TRANSIT', 'CANCELLED', 'RETURNED'],
  IN_TRANSIT: ['ARRIVED_AT_AGENCY', 'RETURNED'],
  ARRIVED_AT_AGENCY: ['READY_FOR_PICKUP', 'COLLECTED', 'RETURNED'],
  READY_FOR_PICKUP: ['COLLECTED', 'RETURNED'],
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

const assertParcelAgencyAccess = (currentUser, parcel, action = 'view') => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'SERVICE_ADMIN') {
    return;
  }

  const userAgencyId = currentUser.agencyId || currentUser.agency?.id;
  if (!userAgencyId) {
    return;
  }

  if (action === 'collect' || action === 'arrival' || action === 'destination') {
    if (parcel.destinationAgencyId && parcel.destinationAgencyId !== userAgencyId) {
      throw new AppError('Access denied: You can only perform this action for parcels assigned to your destination agency', 403);
    }
  } else if (action === 'origin' || action === 'create' || action === 'depart') {
    if (parcel.originAgencyId && parcel.originAgencyId !== userAgencyId) {
      throw new AppError('Access denied: You can only perform this action for parcels originating from your agency', 403);
    }
  } else {
    const isOrigin = parcel.originAgencyId && parcel.originAgencyId === userAgencyId;
    const isDestination = parcel.destinationAgencyId && parcel.destinationAgencyId === userAgencyId;
    if ((parcel.originAgencyId || parcel.destinationAgencyId) && !isOrigin && !isDestination) {
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
  if (query.trackingCode) where.trackingCode = String(query.trackingCode).trim();
  if (query.status) where.status = query.status;
  if (query.originCity) where.originCity = { contains: String(query.originCity).trim(), mode: 'insensitive' };
  if (query.destinationCity) where.destinationCity = { contains: String(query.destinationCity).trim(), mode: 'insensitive' };
  if (query.senderPhone) where.senderPhone = { contains: String(query.senderPhone).trim() };
  if (query.recipientPhone) where.recipientPhone = { contains: String(query.recipientPhone).trim() };

  // Agency isolation for local agents
  const userAgencyId = currentUser.agencyId || currentUser.agency?.id;
  if (userAgencyId && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'SERVICE_ADMIN') {
    where.OR = [
      { originAgencyId: userAgencyId },
      { destinationAgencyId: userAgencyId },
    ];
  }

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
        payments: true,
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
      payments: true,
    },
  });

  if (!parcel) throw new AppError('Parcel not found', 404);
  assertParcelAgencyAccess(currentUser, parcel, 'view');
  return { parcel };
};

const createParcel = async (data, currentUser) => {
  assertCoachAccess(currentUser);
  if (!data.senderName || !data.senderPhone || !data.recipientName || !data.recipientPhone || !data.originCity || !data.destinationCity) {
    throw new AppError('Sender, recipient, and route (origin/destination) information are required', 400);
  }

  const userAgencyId = currentUser.agencyId || currentUser.agency?.id;
  if (userAgencyId && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'SERVICE_ADMIN') {
    if (data.originAgencyId && data.originAgencyId !== userAgencyId) {
      throw new AppError('Access denied: You cannot register a parcel for another origin agency', 403);
    }
    if (!data.originAgencyId) {
      data.originAgencyId = userAgencyId;
    }
  }

  const dept = await getCoachDepartment();
  const pricing = await calculateOfficialPrice({
    originCity: data.originCity,
    destinationCity: data.destinationCity,
    weightKg: data.weightKg,
    volumeM3: data.volumeM3,
    category: data.category,
    declaredValue: data.declaredValue,
    departmentId: dept?.id,
  });

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
        description: data.description ? String(data.description).trim() : null,
        weightKg: Number(data.weightKg) || 0,
        volumeM3: Number(data.volumeM3) || 0,
        declaredValue: data.declaredValue ? Number(data.declaredValue) : null,
        amount: pricing.amount,
        currency: pricing.currency,
        status: initialStatus,
        receivedByUserId: currentUser?.id || null,
        receivedAt: new Date(),
      },
      include: {
        originAgency: true,
        destinationAgency: true,
      },
    });

    await tx.parcelStatusHistory.create({
      data: {
        parcelId: created.id,
        previousStatus: null,
        newStatus: initialStatus,
        changedByUserId: currentUser?.id || null,
        reason: 'Initial parcel registration and physical reception',
        details: { pricingBreakdown: pricing.breakdown },
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

  return { parcel, pricingBreakdown: pricing.breakdown };
};

const payParcel = async (id, paymentData = {}, currentUser) => {
  assertCoachAccess(currentUser);
  const parcel = await prisma.parcel.findUnique({ where: { id }, include: { payments: true } });
  if (!parcel) throw new AppError('Parcel not found', 404);
  assertParcelAgencyAccess(currentUser, parcel, 'origin');

  if (parcel.status !== 'REGISTERED' && parcel.status !== 'PAYMENT_PENDING') {
    throw new AppError(`Parcel is not in a payable state (current status: ${parcel.status})`, 409);
  }

  const channel = String(paymentData.channel || 'AGENCY').toUpperCase();
  const method = String(paymentData.method || 'CASH').toUpperCase();
  const provider = getProvider(channel);

  const paymentInit = await provider.initiatePayment({
    amount: Number(parcel.amount),
    currency: parcel.currency,
    reference: paymentData.reference,
    agentId: currentUser?.id,
    method,
  });

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        parcelId: parcel.id,
        amount: parcel.amount,
        currency: parcel.currency,
        channel: channel === 'ONLINE' ? 'ONLINE' : 'AGENCY',
        method,
        status: paymentInit.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
        provider: provider.name,
        providerTransactionId: paymentInit.providerTransactionId || null,
        providerReference: paymentData.reference ? String(paymentData.reference).trim() : null,
        reference: paymentInit.providerTransactionId || null,
        comment: paymentData.comment ? String(paymentData.comment).trim() : null,
        validatedById: paymentInit.status === 'VERIFIED' ? currentUser?.id : null,
        validatedAt: paymentInit.status === 'VERIFIED' ? new Date() : null,
      },
    });

    let newStatus = parcel.status;
    if (payment.status === 'VERIFIED') {
      newStatus = 'PAID';
      await tx.parcel.update({
        where: { id: parcel.id },
        data: { status: newStatus },
      });

      await tx.parcelStatusHistory.create({
        data: {
          parcelId: parcel.id,
          previousStatus: parcel.status,
          newStatus,
          changedByUserId: currentUser?.id || null,
          reason: `Parcel payment verified via ${channel} (${method})`,
          details: { paymentId: payment.id, amount: payment.amount, reference: payment.reference },
        },
      });
    } else if (channel === 'ONLINE') {
      newStatus = 'PAYMENT_PENDING';
      await tx.parcel.update({
        where: { id: parcel.id },
        data: { status: newStatus },
      });
    }

    return { payment, newStatus };
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

const changeParcelStatus = async (id, { newStatus, reason, details } = {}, currentUser) => {
  assertCoachAccess(currentUser);
  if (!newStatus) throw new AppError('newStatus is required', 400);

  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) throw new AppError('Parcel not found', 404);

  const isOriginAction = ['ACCEPTED', 'IN_TRANSIT'].includes(newStatus);
  const isDestinationAction = ['ARRIVED_AT_AGENCY', 'READY_FOR_PICKUP', 'COLLECTED'].includes(newStatus);
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

  const updated = await prisma.$transaction(async (tx) => {
    const count = await tx.parcel.updateMany({
      where: { id, status: parcel.status },
      data: { status: newStatus },
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
        details: details || null,
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

const collectParcel = async (id, pickupData = {}, currentUser) => {
  assertCoachAccess(currentUser);
  const { collectorName, collectorPhone, idType, idNumber, notes } = pickupData;

  if (!collectorName || !collectorPhone || !idType || !idNumber) {
    throw new AppError('Collector name, phone, ID type and ID number are strictly required for parcel pickup', 400);
  }

  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) throw new AppError('Parcel not found', 404);
  assertParcelAgencyAccess(currentUser, parcel, 'collect');

  if (parcel.status !== 'READY_FOR_PICKUP' && parcel.status !== 'ARRIVED_AT_AGENCY') {
    throw new AppError(`Parcel cannot be collected in status '${parcel.status}'. Must be ARRIVED_AT_AGENCY or READY_FOR_PICKUP`, 409);
  }

  const idNumberEncrypted = encryptSensitiveData(String(idNumber).trim());
  const idNumberMasked = maskIdNumber(String(idNumber).trim());

  const result = await prisma.$transaction(async (tx) => {
    // Atomic update to ensure single pickup
    const updateResult = await tx.parcel.updateMany({
      where: {
        id,
        status: { in: ['READY_FOR_PICKUP', 'ARRIVED_AT_AGENCY'] },
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
        reason: `Parcel successfully delivered to collector ${collectorName}`,
        details: { pickupId: pickup.id, collectorPhone, idType },
      },
    });

    return { pickup, parcel: await tx.parcel.findUnique({ where: { id } }) };
  });

  await auditService.log('collect_parcel', currentUser.id, {
    targetParcelId: id,
    pickupId: result.pickup.id,
    collectorName: result.pickup.collectorName,
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

const getParcelReceiptContext = async (id, currentUser) => {
  assertCoachAccess(currentUser);
  const parcel = await prisma.parcel.findUnique({
    where: { id },
    include: {
      originAgency: true,
      destinationAgency: true,
      payments: { where: { status: 'VERIFIED' }, take: 1, orderBy: { createdAt: 'desc' } },
      receivedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!parcel) throw new AppError('Parcel not found', 404);
  assertParcelAgencyAccess(currentUser, parcel, 'view');

  const signedQr = buildSignedQrPayload('parcel', parcel.trackingCode);
  const payment = parcel.payments[0] || null;

  return {
    companyName: 'Vanguard Services',
    trackingCode: parcel.trackingCode,
    qrPayload: signedQr,
    senderName: parcel.senderName,
    senderPhone: parcel.senderPhone,
    recipientName: parcel.recipientName,
    recipientPhone: parcel.recipientPhone,
    origin: parcel.originAgency?.name ? `${parcel.originCity} (${parcel.originAgency.name})` : parcel.originCity,
    destination: parcel.destinationAgency?.name ? `${parcel.destinationCity} (${parcel.destinationAgency.name})` : parcel.destinationCity,
    category: parcel.category,
    description: parcel.description,
    weightKg: Number(parcel.weightKg),
    volumeM3: Number(parcel.volumeM3),
    amount: Number(parcel.amount).toFixed(2),
    currency: parcel.currency,
    paymentStatus: payment ? 'PAID' : (parcel.status === 'PAID' ? 'PAID' : 'PENDING'),
    paymentReference: payment?.reference || payment?.providerTransactionId || 'N/A',
    receivedAt: parcel.receivedAt || parcel.createdAt,
    receivedBy: parcel.receivedBy ? `${parcel.receivedBy.firstName} ${parcel.receivedBy.lastName}` : 'Agent Vanguard',
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

  const allowedFields = ['description', 'senderEmail', 'recipientEmail', 'originAgencyId', 'destinationAgencyId'];
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
  collectParcel,
  getParcelIdentityData,
  getParcelReceiptContext,
  trackPublicParcel,
  updateParcel,
  deleteParcel,
};

