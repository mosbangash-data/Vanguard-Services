const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const validateListUsersInput = (req, res, next) => {
  const { status, departmentId, roleId, page, limit } = req.query;
  const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'status must be ACTIVE, INACTIVE or SUSPENDED' });
  }
  if (page && Number.isNaN(Number(page))) {
    return res.status(400).json({ success: false, message: 'page must be a number' });
  }
  if (limit && Number.isNaN(Number(limit))) {
    return res.status(400).json({ success: false, message: 'limit must be a number' });
  }
  if (departmentId && !normalizeString(departmentId)) {
    return res.status(400).json({ success: false, message: 'departmentId must be a valid identifier' });
  }
  if (roleId && !normalizeString(roleId)) {
    return res.status(400).json({ success: false, message: 'roleId must be a valid identifier' });
  }

  return next();
};

const validateCreateUserInput = (req, res, next) => {
  const firstName = normalizeString(req.body?.firstName);
  const lastName = normalizeString(req.body?.lastName);
  const email = normalizeString(req.body?.email);
  const roleId = normalizeString(req.body?.roleId);
  const departmentId = normalizeString(req.body?.departmentId);

  if (!firstName || !lastName || !email || !roleId || !departmentId) {
    return res.status(400).json({ success: false, message: 'firstName, lastName, email, roleId and departmentId are required' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, message: 'email must be a valid email address' });
  }

  return next();
};

const validateStatusInput = (req, res, next) => {
  const status = normalizeString(req.body?.status);

  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    return res.status(400).json({ success: false, message: 'status must be ACTIVE or INACTIVE' });
  }

  return next();
};

const validatePasswordResetInput = (req, res, next) => {
  // Password reset is triggered without requiring a new password from the caller.
  // The service will generate a temporary password for the user.
  return next();
};

module.exports = {
  validateListUsersInput,
  validateCreateUserInput,
  validateStatusInput,
  validatePasswordResetInput,
};
