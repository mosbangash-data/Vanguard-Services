const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const vehicleRepository = require('../repositories/vehicleRepository');
const userRepository = require('../services/userRepository');
const vehicleInquiryRepository = require('../repositories/vehicleInquiryRepository');
const { assertDepartmentIdForUser } = require('./departmentAccessService');

const assertAutoSalesAccess = (currentUser) => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  if (currentUser.role !== 'SUPER_ADMIN' && currentUser.department?.type !== 'AUTO_SALES') {
    throw new AppError('Access denied', 403);
  }
};

const normalizePage = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const normalizeLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  if (parsed < 1) return 1;
  return Math.min(parsed, 100);
};

const listVehicleInquiries = async (query, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_VEHICLE_INQUIRY')) throw new AppError('Insufficient permissions', 403);

  if (currentUser.role === 'AGENT' || currentUser.role === 'SALES_AGENT') {
    const forcedAssignedToUserId = query?.assignedToUserId ? String(query.assignedToUserId) : null;
    if (forcedAssignedToUserId !== currentUser.id) {
      throw new AppError('Access denied', 403);
    }
  }

  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const skip = (page - 1) * limit;

  const where = {};
  if (currentUser.role === 'AGENT' || currentUser.role === 'SALES_AGENT') {
    where.assignedToUserId = currentUser.id;
    where.vehicle = { department: { type: 'AUTO_SALES' } };
  } else if (currentUser.role !== 'SUPER_ADMIN') {
    where.vehicle = { department: { type: 'AUTO_SALES' } };
  }
  if (query.vehicleId) where.vehicleId = query.vehicleId;
  if (query.status) where.status = query.status;
  if (query.assignedToUserId) where.assignedToUserId = query.assignedToUserId;
  if (query.customerPhone) where.customerPhone = { contains: String(query.customerPhone).trim(), mode: 'insensitive' };
  if (query.customerEmail) where.customerEmail = { contains: String(query.customerEmail).trim(), mode: 'insensitive' };
  if (query.search) {
    const search = String(query.search).trim();
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
        { internalNotes: { contains: search, mode: 'insensitive' } },
      ];
    }
  }

  const { items, total } = await vehicleInquiryRepository.listVehicleInquiries({ where, skip, take: limit });
  return { items, page, limit, total };
};

const getVehicleInquiryById = async (id, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_VEHICLE_INQUIRY')) throw new AppError('Insufficient permissions', 403);

  const inquiry = await vehicleInquiryRepository.getVehicleInquiryById(id);
  if (!inquiry) throw new AppError('Vehicle inquiry not found', 404);
  await assertDepartmentIdForUser(currentUser, inquiry.vehicle.departmentId, 'AUTO_SALES');
  if ((currentUser.role === 'AGENT' || currentUser.role === 'SALES_AGENT')
    && inquiry.assignedToUserId !== null
    && inquiry.assignedToUserId !== currentUser.id) {
    throw new AppError('Access denied', 403);
  }
  return { vehicleInquiry: inquiry };
};

const createVehicleInquiry = async (data, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('CREATE_VEHICLE_INQUIRY')) throw new AppError('Insufficient permissions', 403);

  const vehicleId = typeof data?.vehicleId === 'string' ? data.vehicleId : null;
  const customerName = typeof data?.customerName === 'string' ? data.customerName.trim() : '';
  const customerPhone = typeof data?.customerPhone === 'string' ? data.customerPhone.trim() : '';
  const customerEmail = typeof data?.customerEmail === 'string' ? data.customerEmail.trim() : null;
  const inquiryType = typeof data?.inquiryType === 'string' ? data.inquiryType : null;
  const contactPreference = typeof data?.contactPreference === 'string' ? data.contactPreference.trim() : null;
  const message = typeof data?.message === 'string' ? data.message.trim() : '';

  if (!vehicleId || !customerName || !customerPhone || !message) {
    throw new AppError('vehicleId, customerName, customerPhone and message are required', 400);
  }

  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new AppError('customerEmail must be a valid email address', 400);
  }

  const vehicle = await vehicleRepository.getVehicleById(vehicleId);
  if (!vehicle) throw new AppError('Vehicle not found', 404);
  await assertDepartmentIdForUser(currentUser, vehicle.departmentId, 'AUTO_SALES');

  const createdByUserId = currentUser?.id || null;
  if (!createdByUserId) throw new AppError('Unauthorized', 401);

  const validInquiryTypes = ['INFORMATION', 'PRICE_REQUEST', 'CONTACT'];
  const chosenInquiryType = inquiryType || 'INFORMATION';
  if (!validInquiryTypes.includes(chosenInquiryType)) {
    throw new AppError('Invalid inquiryType', 400);
  }

  const validContactPreferences = ['PHONE', 'EMAIL', 'WHATSAPP', 'VISIT', 'OTHER'];
  if (contactPreference && !validContactPreferences.includes(contactPreference.toUpperCase())) {
    throw new AppError('Invalid contactPreference', 400);
  }

  const inquiry = await vehicleInquiryRepository.createVehicleInquiry({
    vehicleId,
    customerName,
    customerEmail,
    customerPhone,
    inquiryType: chosenInquiryType,
    contactPreference: contactPreference ? contactPreference.toUpperCase() : null,
    message,
    status: 'NEW',
    createdByUserId,
  });

  await auditService.log('create_vehicle_inquiry', createdByUserId, { targetVehicleId: vehicleId, vehicleInquiryId: inquiry.id });
  return { vehicleInquiry: inquiry };
};

const updateVehicleInquiry = async (id, data, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('UPDATE_VEHICLE_INQUIRY')) throw new AppError('Insufficient permissions', 403);

  const inquiry = await vehicleInquiryRepository.getVehicleInquiryById(id);
  if (!inquiry) throw new AppError('Vehicle inquiry not found', 404);
  await assertDepartmentIdForUser(currentUser, inquiry.vehicle.departmentId, 'AUTO_SALES');

  const isAgentAssignedToInquiry = (currentUser.role === 'AGENT' || currentUser.role === 'SALES_AGENT')
    && (inquiry.assignedToUserId === null || inquiry.assignedToUserId === currentUser.id);
  if ((currentUser.role === 'AGENT' || currentUser.role === 'SALES_AGENT') && !isAgentAssignedToInquiry) {
    throw new AppError('Access denied', 403);
  }

  const updatePayload = {};
  if (data?.status !== undefined) updatePayload.status = data.status;
  if (data?.assignedToUserId !== undefined) updatePayload.assignedToUserId = data.assignedToUserId || null;
  if (data?.internalNotes !== undefined) updatePayload.internalNotes = data.internalNotes ? String(data.internalNotes).trim() : null;
  if (data?.customerName !== undefined) updatePayload.customerName = String(data.customerName).trim();
  if (data?.customerPhone !== undefined) updatePayload.customerPhone = String(data.customerPhone).trim();
  if (data?.customerEmail !== undefined) updatePayload.customerEmail = data.customerEmail ? String(data.customerEmail).trim() : null;
  if (data?.message !== undefined) updatePayload.message = String(data.message).trim();
  if (data?.contactPreference !== undefined) updatePayload.contactPreference = data.contactPreference ? String(data.contactPreference).trim().toUpperCase() : null;

  if (updatePayload.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updatePayload.customerEmail)) {
    throw new AppError('customerEmail must be a valid email address', 400);
  }
  if (updatePayload.customerName !== undefined && updatePayload.customerName.length === 0) {
    throw new AppError('customerName cannot be empty', 400);
  }
  if (updatePayload.customerPhone !== undefined && updatePayload.customerPhone.length === 0) {
    throw new AppError('customerPhone cannot be empty', 400);
  }
  if (updatePayload.message !== undefined && updatePayload.message.length > 0 && updatePayload.message.length < 10) {
    throw new AppError('message must be at least 10 characters', 400);
  }
  if (updatePayload.contactPreference !== undefined) {
    const validContactPreferences = ['PHONE', 'EMAIL', 'WHATSAPP', 'VISIT', 'OTHER'];
    if (updatePayload.contactPreference && !validContactPreferences.includes(updatePayload.contactPreference)) {
      throw new AppError('Invalid contactPreference', 400);
    }
  }

  if (updatePayload.assignedToUserId) {
    const user = await userRepository.findById(updatePayload.assignedToUserId);
    if (!user) throw new AppError('Assigned user not found', 404);

    const isEscalatedManager = ['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(currentUser.role);
    const isSelfAssignment = user.id === currentUser.id && isEscalatedManager;

    if (!isSelfAssignment) {
      if (user.department?.type !== 'AUTO_SALES') throw new AppError('Assigned user must belong to AUTO_SALES', 403);
      if (!['AGENT', 'SALES_AGENT'].includes(user.role?.name)) throw new AppError('Assigned user must be an AutoSales agent', 403);
      if ((currentUser.role === 'AGENT' || currentUser.role === 'SALES_AGENT') && user.id !== currentUser.id) throw new AppError('Access denied', 403);
    }

    await auditService.log('assign_vehicle_inquiry', currentUser.id, { targetVehicleInquiryId: id, assignedToUserId: updatePayload.assignedToUserId });
  }

  if (updatePayload.status) {
    const validStatuses = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'CONVERTED', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(updatePayload.status)) {
      throw new AppError('Invalid inquiry status', 400);
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new AppError('No valid fields provided for update', 400);
  }

  if (updatePayload.status) {
    await auditService.log('vehicle_inquiry_status_change', currentUser.id, { targetVehicleInquiryId: id, status: updatePayload.status });
  }

  const updatedInquiry = await vehicleInquiryRepository.updateVehicleInquiry(id, updatePayload);
  await auditService.log('update_vehicle_inquiry', currentUser.id, { targetVehicleInquiryId: id, changes: updatePayload });

  return { vehicleInquiry: updatedInquiry };
};

const assignVehicleInquiry = async (id, assignedToUserId, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('ASSIGN_VEHICLE_INQUIRY')) throw new AppError('Insufficient permissions', 403);
  if (typeof assignedToUserId !== 'string' || !assignedToUserId.trim()) throw new AppError('assignedToUserId is required', 400);
  const inquiry = await vehicleInquiryRepository.getVehicleInquiryById(id);
  if (!inquiry) throw new AppError('Vehicle inquiry not found', 404);
  await assertDepartmentIdForUser(currentUser, inquiry.vehicle.departmentId, 'AUTO_SALES');
  const assignee = await userRepository.findById(assignedToUserId);
  const isEscalatedManager = ['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(currentUser.role);
  const isSelfAssignment = assignee && assignee.id === currentUser.id && isEscalatedManager;

  const allowedAssigneeRoles = ['AGENT', 'SALES_AGENT'];
  if (!assignee || (assignee.department?.type !== 'AUTO_SALES' && !isSelfAssignment) || (!allowedAssigneeRoles.includes(assignee.role?.name) && !isSelfAssignment)) {
    throw new AppError('Assigned user must be an AutoSales agent', 400);
  }
  const vehicleInquiry = await vehicleInquiryRepository.updateVehicleInquiry(id, { assignedToUserId: assignee.id });
  await auditService.log('assign_vehicle_inquiry', currentUser.id, { targetVehicleInquiryId: id, assignedToUserId: assignee.id });
  return { vehicleInquiry };
};

module.exports = {
  listVehicleInquiries,
  getVehicleInquiryById,
  createVehicleInquiry,
  updateVehicleInquiry,
  assignVehicleInquiry,
};
