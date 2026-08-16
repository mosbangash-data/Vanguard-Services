const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { requireDepartmentType, assertDepartmentIdForUser } = require('./departmentAccessService');

const normalizePage = (v) => { const p = Number(v); return Number.isFinite(p) && p > 0 ? p : 1; };
const normalizeLimit = (v) => { const p = Number(v); if (!Number.isFinite(p)) return 100; return Math.min(Math.max(1, p), 1000); };

const assertSeatAccess = async (currentUser, bus) => {
  requireDepartmentType(currentUser, 'VANGUARD_COACH');
  if (!currentUser.permissions.includes('VIEW_RESERVATION')) throw new AppError('Insufficient permissions', 403);
  await assertDepartmentIdForUser(currentUser, bus.departmentId, 'VANGUARD_COACH');
};

const listSeatsForBus = async (busId, tripId, currentUser) => {
  const bus = await prisma.bus.findUnique({ where: { id: busId } });
  if (!bus) throw new AppError('Bus not found', 404);
  await assertSeatAccess(currentUser, bus);

  const totalSeats = bus.seats || 0;
  let occupied = [];
  if (tripId) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { schedule: true } });
    if (!trip || trip.schedule.busId !== bus.id) throw new AppError('Trip does not belong to this bus', 400);
    await assertDepartmentIdForUser(currentUser, trip.schedule.departmentId, 'VANGUARD_COACH');
    const res = await prisma.reservation.findMany({ where: { tripId }, select: { seatNumber: true, id: true } });
    occupied = res.map(r => ({ seatNumber: String(r.seatNumber), reservationId: r.id }));
  }

  const seats = Array.from({ length: totalSeats }, (_, i) => {
    const number = String(i + 1);
    const occ = occupied.find(o => o.seatNumber === number);
    return { seatNumber: number, status: occ ? 'OCCUPIED' : 'AVAILABLE', reservationId: occ ? occ.reservationId : null };
  });

  return { items: seats, total: seats.length };
};

const getSeat = async (busId, seatNumber, tripId, currentUser) => {
  const bus = await prisma.bus.findUnique({ where: { id: busId } });
  if (!bus) throw new AppError('Bus not found', 404);
  await assertSeatAccess(currentUser, bus);
  const totalSeats = bus.seats || 0;
  const num = Number(seatNumber);
  if (!Number.isFinite(num) || num < 1 || num > totalSeats) throw new AppError('Invalid seat number', 400);

  let reservation = null;
  if (tripId) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { schedule: true } });
    if (!trip || trip.schedule.busId !== bus.id) throw new AppError('Trip does not belong to this bus', 400);
    await assertDepartmentIdForUser(currentUser, trip.schedule.departmentId, 'VANGUARD_COACH');
    reservation = await prisma.reservation.findFirst({ where: { tripId, seatNumber: String(seatNumber) } });
  }

  return { seat: { seatNumber: String(seatNumber), status: reservation ? 'OCCUPIED' : 'AVAILABLE', reservationId: reservation ? reservation.id : null } };
};

module.exports = { listSeatsForBus, getSeat };
