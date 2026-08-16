const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const vehicleRepository = require('../repositories/vehicleRepository');
const { getScopedDepartmentId, assertDepartmentIdForUser } = require('./departmentAccessService');

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

const isValidYear = (value) => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1886 && year <= new Date().getFullYear() + 1;
};

const isValidDecimal = (value) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim();
  return /^[0-9]+(\.[0-9]{1,2})?$/.test(normalized) && Number(normalized) >= 0;
};

const resolveVehicleCurrency = async (departmentId, value) => {
  const configured = await require('../config/prisma').serviceSettings.findUnique({ where: { departmentId }, select: { currency: true } });
  const currency = value === undefined || value === null || value === '' ? (configured?.currency || 'USD') : String(value).trim().toUpperCase();
  if (!['USD', 'CDF'].includes(currency)) throw new AppError('currency must be USD or CDF', 400);
  return currency;
};

const listVehicles = async (query = {}, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_VEHICLE')) throw new AppError('Insufficient permissions', 403);

  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const skip = (page - 1) * limit;

  const where = {};
  const departmentId = await getScopedDepartmentId(currentUser, query.departmentId, 'AUTO_SALES');
  if (departmentId) where.departmentId = departmentId;
  if (query.status) where.status = query.status;
  if (query.search) {
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (search) {
      where.OR = [
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
  }

  const { items, total } = await vehicleRepository.listVehicles({ where, skip, take: limit });
  return { items, page, limit, total };
};

const getVehicleById = async (id, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_VEHICLE')) throw new AppError('Insufficient permissions', 403);

  const vehicle = await vehicleRepository.getVehicleById(id);
  if (!vehicle) throw new AppError('Vehicle not found', 404);
  await assertDepartmentIdForUser(currentUser, vehicle.departmentId, 'AUTO_SALES');
  return { vehicle };
};

const createVehicle = async (data, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('CREATE_VEHICLE')) throw new AppError('Insufficient permissions', 403);

  const departmentId = await getScopedDepartmentId(currentUser, typeof data?.departmentId === 'string' && data.departmentId.trim() ? data.departmentId.trim() : null, 'AUTO_SALES');
  const brand = typeof data?.brand === 'string' ? data.brand.trim() : '';
  const model = typeof data?.model === 'string' ? data.model.trim() : '';
  const year = isValidYear(data?.year) ? Number(data.year) : null;
  const mileage = data?.mileage !== undefined && data.mileage !== null ? Number(data.mileage) : null;
  const fuelType = data?.fuelType !== undefined ? (data.fuelType ? String(data.fuelType).trim() : null) : null;
  const transmission = data?.transmission !== undefined ? (data.transmission ? String(data.transmission).trim() : null) : null;
  const price = data?.price !== undefined && data.price !== null ? String(data.price).trim() : null;
  const description = data?.description ? String(data.description).trim() : null;
  const color = data?.color ? String(data.color).trim() : null;

  if (!departmentId || !brand || !model || year === null || !price) {
    throw new AppError('departmentId, brand, model, year and price are required', 400);
  }
  if (!isValidDecimal(price)) {
    throw new AppError('price must be a valid positive amount', 400);
  }
  if (mileage !== null && (!Number.isInteger(mileage) || mileage < 0)) {
    throw new AppError('mileage must be a non-negative integer', 400);
  }
  const currency = await resolveVehicleCurrency(departmentId, data?.currency);

  const vehicle = await vehicleRepository.createVehicle({
    departmentId,
    brand,
    model,
    year,
    mileage,
    fuelType,
    transmission,
    price,
    currency,
    color,
    description,
  });

  await auditService.log('create_vehicle', currentUser.id, { targetVehicleId: vehicle.id });
  return { vehicle };
};

const updateVehicle = async (id, data, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('UPDATE_VEHICLE')) throw new AppError('Insufficient permissions', 403);

  const vehicle = await vehicleRepository.getVehicleById(id);
  if (!vehicle) throw new AppError('Vehicle not found', 404);
  await assertDepartmentIdForUser(currentUser, vehicle.departmentId, 'AUTO_SALES');

  const updatePayload = {};
  if (data?.departmentId !== undefined) {
    const departmentId = typeof data.departmentId === 'string' && data.departmentId.trim() ? data.departmentId.trim() : null;
    if (!departmentId) throw new AppError('departmentId must be a valid identifier', 400);
    await assertDepartmentIdForUser(currentUser, departmentId, 'AUTO_SALES');
    updatePayload.departmentId = departmentId;
  }
  if (data?.brand !== undefined) {
    const brand = typeof data.brand === 'string' ? data.brand.trim() : '';
    if (!brand) throw new AppError('brand cannot be empty', 400);
    updatePayload.brand = brand;
  }
  if (data?.model !== undefined) {
    const model = typeof data.model === 'string' ? data.model.trim() : '';
    if (!model) throw new AppError('model cannot be empty', 400);
    updatePayload.model = model;
  }
  if (data?.year !== undefined) {
    if (!isValidYear(data.year)) {
      throw new AppError('year must be a valid number between 1886 and next year', 400);
    }
    updatePayload.year = Number(data.year);
  }
  if (data?.mileage !== undefined) {
    if (data.mileage !== null && (!Number.isInteger(Number(data.mileage)) || Number(data.mileage) < 0)) {
      throw new AppError('mileage must be a non-negative integer', 400);
    }
    updatePayload.mileage = data.mileage !== null ? Number(data.mileage) : null;
  }
  if (data?.fuelType !== undefined) {
    updatePayload.fuelType = data.fuelType ? String(data.fuelType).trim() : null;
  }
  if (data?.transmission !== undefined) {
    updatePayload.transmission = data.transmission ? String(data.transmission).trim() : null;
  }
  if (data?.price !== undefined) {
    if (data.price === null) {
      throw new AppError('price cannot be null', 400);
    }
    const price = String(data.price).trim();
    if (!isValidDecimal(price)) {
      throw new AppError('price must be a valid positive amount', 400);
    }
    updatePayload.price = price;
  }
  if (data?.currency !== undefined) updatePayload.currency = await resolveVehicleCurrency(vehicle.departmentId, data.currency);
  if (data?.color !== undefined) updatePayload.color = data.color ? String(data.color).trim() : null;
  if (data?.description !== undefined) {
    updatePayload.description = data.description ? String(data.description).trim() : null;
  }
  if (data?.status !== undefined) {
    const validStatus = ['AVAILABLE', 'RESERVED', 'SOLD', 'IN_MAINTENANCE'];
    if (!validStatus.includes(data.status)) {
      throw new AppError('Invalid vehicle status', 400);
    }
    const transitions = {
      AVAILABLE: ['RESERVED', 'IN_MAINTENANCE'],
      RESERVED: ['AVAILABLE', 'SOLD', 'IN_MAINTENANCE'],
      IN_MAINTENANCE: ['AVAILABLE'],
      SOLD: [],
    };
    if (data.status !== vehicle.status && !transitions[vehicle.status].includes(data.status)) {
      throw new AppError(`Vehicle status cannot transition from ${vehicle.status} to ${data.status}`, 409);
    }
    updatePayload.status = data.status;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new AppError('No valid fields provided for update', 400);
  }

  const updatedVehicle = await vehicleRepository.updateVehicle(id, updatePayload);
  await auditService.log('update_vehicle', currentUser.id, { targetVehicleId: id, changes: updatePayload });
  return { vehicle: updatedVehicle };
};

const deleteVehicle = async (id, currentUser) => {
  assertAutoSalesAccess(currentUser);
  if (!currentUser.permissions.includes('DELETE_VEHICLE')) throw new AppError('Insufficient permissions', 403);

  const vehicle = await vehicleRepository.getVehicleById(id);
  if (!vehicle) throw new AppError('Vehicle not found', 404);
  await assertDepartmentIdForUser(currentUser, vehicle.departmentId, 'AUTO_SALES');

  const inquiryCount = await vehicleRepository.countVehicleInquiries(id);
  if (inquiryCount > 0) {
    throw new AppError('Cannot delete vehicle with existing inquiries', 409);
  }

  const reservationCount = await vehicleRepository.countVehicleReservations(id);
  if (reservationCount > 0) {
    throw new AppError('Cannot delete vehicle with existing reservations', 409);
  }

  await vehicleRepository.deleteVehicle(id);
  await auditService.log('delete_vehicle', currentUser.id, { targetVehicleId: id });
  return { success: true };
};

const canAccessInternalVehicleData = (currentUser) => currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.department?.type === 'AUTO_SALES');

const listPublicVehicles = async (query = {}, currentUser) => {
  if (canAccessInternalVehicleData(currentUser)) {
    return listVehicles(query, currentUser);
  }

  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const skip = (page - 1) * limit;

  const where = { status: 'AVAILABLE' };
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.search) {
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (search) {
      where.OR = [
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
  }

  const { items, total } = await vehicleRepository.listVehicles({ where, skip, take: limit });
  return { items, page, limit, total };
};

const getPublicVehicle = async (id, currentUser) => {
  if (canAccessInternalVehicleData(currentUser)) {
    return getVehicleById(id, currentUser);
  }

  const vehicle = await vehicleRepository.getVehicleById(id);
  if (!vehicle || vehicle.status !== 'AVAILABLE') throw new AppError('Vehicle not found', 404);
  return { vehicle };
};

module.exports = { listVehicles, getVehicleById, createVehicle, updateVehicle, deleteVehicle, listPublicVehicles, getPublicVehicle };
