const userService = require('../services/userService');
const roleService = require('../services/roleService');
const permissionService = require('../services/permissionService');
const departmentService = require('../services/departmentService');
const auditService = require('../services/auditService');

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

const listRoles = async (req, res, next) => {
  try {
    const result = await roleService.listRoles(req.query, req.user);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getRoleById = async (req, res, next) => {
  try {
    const result = await roleService.getRoleById(req.params.id, req.user);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const createRole = async (req, res, next) => {
  try {
    const result = await roleService.createRole(req.body, req.user);
    return res.status(201).json({ success: true, message: 'Role created successfully', data: result });
  } catch (error) {
    return next(error);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const result = await roleService.updateRole(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: 'Role updated successfully', data: result });
  } catch (error) {
    return next(error);
  }
};

const deleteRole = async (req, res, next) => {
  try {
    const result = await roleService.deleteRole(req.params.id, req.user);
    return res.status(200).json({ success: true, message: 'Role deleted successfully', data: result });
  } catch (error) {
    return next(error);
  }
};

const listPermissions = async (req, res, next) => {
  try {
    const result = await permissionService.listPermissions(req.query, req.user);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getPermissionById = async (req, res, next) => {
  try {
    const result = await permissionService.getPermissionById(req.params.id, req.user);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const createPermission = async (req, res, next) => {
  try {
    const result = await permissionService.createPermission(req.body, req.user);
    return res.status(201).json({ success: true, message: 'Permission created successfully', data: result });
  } catch (error) {
    return next(error);
  }
};

const updatePermission = async (req, res, next) => {
  try {
    const result = await permissionService.updatePermission(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: 'Permission updated successfully', data: result });
  } catch (error) {
    return next(error);
  }
};

const deletePermission = async (req, res, next) => {
  try {
    const result = await permissionService.deletePermission(req.params.id, req.user);
    return res.status(200).json({ success: true, message: 'Permission deleted successfully', data: result });
  } catch (error) {
    return next(error);
  }
};

const listDepartments = async (req, res, next) => {
  try {
    const result = await departmentService.listDepartments(req.query, req.user);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getDepartmentById = async (req, res, next) => {
  try {
    const result = await departmentService.getDepartmentById(req.params.id, req.user);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const createDepartment = async (req, res, next) => {
  try {
    const result = await departmentService.createDepartment(req.body, req.user);
    return res.status(201).json({ success: true, message: 'Department created successfully', data: result });
  } catch (error) {
    return next(error);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    const result = await departmentService.updateDepartment(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: 'Department updated successfully', data: result });
  } catch (error) {
    return next(error);
  }
};

const deleteDepartment = async (req, res, next) => {
  try {
    const result = await departmentService.deleteDepartment(req.params.id, req.user);
    return res.status(200).json({ success: true, message: 'Department deleted successfully', data: result });
  } catch (error) {
    return next(error);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const result = await auditService.getLogs(req.query, req.user);
    return res.status(200).json({ success: true, data: result });
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
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getAuditLogs,
};
