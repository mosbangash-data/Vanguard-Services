const roleService = require('../services/roleService');

const getRolePermissions = async (req, res, next) => {
  try {
    const permissions = await roleService.getRolePermissions(req.params.id, req.user);
    return res.status(200).json({ success: true, data: permissions });
  } catch (error) {
    return next(error);
  }
};

const setRolePermissions = async (req, res, next) => {
  try {
    const permissions = await roleService.setRolePermissions(req.params.id, req.body.permissionIds, req.user);
    return res.status(200).json({ success: true, message: 'Role permissions updated successfully', data: permissions });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getRolePermissions,
  setRolePermissions,
};
