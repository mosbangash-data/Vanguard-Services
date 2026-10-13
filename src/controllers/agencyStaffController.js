const service = require('../services/agencyStaffService');

const respond = (handler, statusCode = 200) => async (req, res, next) => {
  try {
    const data = await handler(req);
    res.status(statusCode).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list: respond((req) => service.listStaffMembers(req.query, req.user)),
  create: respond((req) => service.createStaffMember(req.body, req.user), 201),
  get: respond((req) => service.getStaffMember(req.params.id, req.user)),
  update: respond((req) => service.updateStaffMember(req.params.id, req.body, req.user)),
  updateStatus: respond((req) => service.updateStaffMemberStatus(req.params.id, req.body?.isActive, req.user)),
  listAttendance: respond((req) => service.listAttendance(req.params.id, req.query, req.user)),
  upsertAttendance: respond((req) => service.upsertAttendance(req.params.id, req.body, req.user)),
};
