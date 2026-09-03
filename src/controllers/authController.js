const authService = require('../services/authService');

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const result = await authService.getCurrentUser(req.user.id);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const result = await authService.changePassword(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const result = await authService.resetPasswordWithToken(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  login,
  getProfile,
  changePassword,
  forgotPassword,
  resetPassword,
};
