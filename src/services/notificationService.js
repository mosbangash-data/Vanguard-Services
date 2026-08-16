const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');

const listNotifications = async (query = {}, currentUser) => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  const where = {};
  if (currentUser) where.userId = currentUser.id;
  const items = await prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' } });
  return { items };
};

const createNotification = async (data, currentUser) => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  const targetUserId = data.userId ?? currentUser.id;
  if (targetUserId !== currentUser.id) {
    if (!['SUPER_ADMIN', 'SERVICE_ADMIN'].includes(currentUser.role)) {
      throw new AppError('Access denied', 403);
    }
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, include: { department: true } });
    if (!targetUser) throw new AppError('Target user not found', 404);
    if (currentUser.role === 'SERVICE_ADMIN' && targetUser.department?.type !== currentUser.department?.type) {
      throw new AppError('Access to this user is not allowed', 403);
    }
  }
  const payload = {
    userId: targetUserId,
    recipientEmail: data.recipientEmail,
    recipientPhone: data.recipientPhone,
    channel: data.channel ?? 'IN_APP',
    title: data.title,
    message: data.message,
  };
  const notification = await prisma.notification.create({ data: payload });
  await auditService.log('create_notification', currentUser.id, { targetNotificationId: notification.id });
  return { notification };
};

const markRead = async (id, currentUser) => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif) throw new AppError('Notification not found', 404);
  if (notif.userId !== currentUser.id) throw new AppError('Forbidden', 403);
  const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } });
  return { notification: updated };
};

module.exports = { listNotifications, createNotification, markRead };
