const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const validateLoginInput = (req, res, next) => {
  const identifier = normalizeString(req.body?.identifier);
  const password = normalizeString(req.body?.password);

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'identifier and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'password must be at least 8 characters long' });
  }

  return next();
};

const validateCreateUserInput = (req, res, next) => {
  const email = normalizeString(req.body?.email);
  const password = normalizeString(req.body?.password);
  const firstName = normalizeString(req.body?.firstName);
  const lastName = normalizeString(req.body?.lastName);
  const roleName = normalizeString(req.body?.roleName);
  const departmentType = normalizeString(req.body?.departmentType);

  if (!email || !password || !firstName || !lastName || !roleName || !departmentType) {
    return res.status(400).json({
      success: false,
      message: 'email, password, firstName, lastName, roleName and departmentType are required',
    });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, message: 'email must be a valid email address' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'password must be at least 8 characters long' });
  }

  return next();
};

const validateStatusInput = (req, res, next) => {
  const status = normalizeString(req.body?.status);

  if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
    return res.status(400).json({ success: false, message: 'status must be one of ACTIVE, INACTIVE, SUSPENDED' });
  }

  return next();
};

const validatePasswordResetInput = (req, res, next) => {
  const newPassword = normalizeString(req.body?.newPassword);

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'newPassword is required and must be at least 8 characters long' });
  }

  return next();
};

const validateChangePasswordInput = (req, res, next) => {
  const currentPassword = normalizeString(req.body?.currentPassword || req.body?.oldPassword);
  const newPassword = normalizeString(req.body?.newPassword);
  const confirmPassword = normalizeString(req.body?.confirmPassword || req.body?.confirmNewPassword);

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'currentPassword, newPassword and confirmation are required' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'newPassword and confirmation do not match' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'newPassword must be at least 8 characters long' });
  }

  return next();
};

const validateForgotPasswordInput = (req, res, next) => {
  const email = normalizeString(req.body?.email);

  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, message: 'A valid email is required' });
  }

  return next();
};

const validateResetPasswordInput = (req, res, next) => {
  const token = normalizeString(req.body?.token);
  const newPassword = normalizeString(req.body?.newPassword);
  const confirmPassword = normalizeString(req.body?.confirmPassword || req.body?.confirmNewPassword);

  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'token, newPassword and confirmation are required' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'newPassword and confirmation do not match' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'newPassword must be at least 8 characters long' });
  }

  return next();
};

module.exports = {
  validateLoginInput,
  validateCreateUserInput,
  validateStatusInput,
  validatePasswordResetInput,
  validateChangePasswordInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
};
