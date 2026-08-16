const userService = require('../services/userService');

const listUsers = async (req, res, next) => {
  try {
    const result = await userService.listUsers(req.query, req.user);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const result = await userService.getUserById(req.params.id, req.user);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const result = await userService.createUser(req.body, req.user);
    return res.status(201).json({ success: true, message: 'User created successfully', data: result });
  } catch (error) {
    return next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const result = await userService.updateUser(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: 'User updated successfully', data: result });
  } catch (error) {
    return next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const result = await userService.updateUserStatus(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: 'User status updated successfully', data: result });
  } catch (error) {
    return next(error);
  }
};

const resetUserPassword = async (req, res, next) => {
  try {
    const result = await userService.resetUserPassword(req.params.id, req.user);
    return res.status(200).json({ success: true, message: 'Password reset successfully', data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
};
