const validateUserCreateInput = (req, res, next) => {
  const { firstName, lastName, email, roleId, departmentId } = req.body || {};
  if (!firstName || !lastName || !email || !roleId || !departmentId) {
    return res.status(400).json({ success: false, message: 'firstName, lastName, email, roleId and departmentId are required' });
  }
  return next();
};

const validateUserUpdateInput = (req, res, next) => {
  const { firstName, lastName, phone } = req.body || {};
  if (firstName !== undefined && typeof firstName !== 'string') {
    return res.status(400).json({ success: false, message: 'firstName must be a string' });
  }
  if (lastName !== undefined && typeof lastName !== 'string') {
    return res.status(400).json({ success: false, message: 'lastName must be a string' });
  }
  if (phone !== undefined && typeof phone !== 'string') {
    return res.status(400).json({ success: false, message: 'phone must be a string' });
  }
  return next();
};

const validateStatusInput = (req, res, next) => {
  const { status } = req.body || {};
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    return res.status(400).json({ success: false, message: 'status must be ACTIVE or INACTIVE' });
  }
  return next();
};

const validateRoleInput = (req, res, next) => {
  const { name, description } = req.body || {};
  if (name !== undefined && typeof name !== 'string') {
    return res.status(400).json({ success: false, message: 'name must be a string' });
  }
  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json({ success: false, message: 'description must be a string' });
  }
  return next();
};

const validatePermissionInput = (req, res, next) => {
  const { name, description } = req.body || {};
  if (name !== undefined && typeof name !== 'string') {
    return res.status(400).json({ success: false, message: 'name must be a string' });
  }
  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json({ success: false, message: 'description must be a string' });
  }
  return next();
};

const validateDepartmentInput = (req, res, next) => {
  const { type, name, description, isActive } = req.body || {};
  if (type !== undefined && typeof type !== 'string') {
    return res.status(400).json({ success: false, message: 'type must be a string' });
  }
  if (name !== undefined && typeof name !== 'string') {
    return res.status(400).json({ success: false, message: 'name must be a string' });
  }
  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json({ success: false, message: 'description must be a string' });
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive must be a boolean' });
  }
  return next();
};

module.exports = {
  validateUserCreateInput,
  validateUserUpdateInput,
  validateStatusInput,
  validateRoleInput,
  validatePermissionInput,
  validateDepartmentInput,
};
