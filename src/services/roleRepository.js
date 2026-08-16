const prisma = require('../config/prisma');

const findMany = async ({ where, skip, take, orderBy, include }) =>
  prisma.role.findMany({ where, skip, take, orderBy, include });

const count = async (where) => prisma.role.count({ where });

const findById = async (roleId) =>
  prisma.role.findUnique({
    where: { id: roleId },
    include: { permissions: { include: { permission: true } } },
  });

const findByName = async (name) => prisma.role.findUnique({ where: { name } });

const createRole = async (data) => prisma.role.create({ data });

const updateRole = async (roleId, data) => prisma.role.update({ where: { id: roleId }, data });

const deleteRolePermissions = async (roleId) => prisma.rolePermission.deleteMany({ where: { roleId } });

const countUsersWithRole = async (roleId) => prisma.user.count({ where: { roleId } });

const deleteRole = async (roleId) => prisma.role.delete({ where: { id: roleId } });

module.exports = {
  findMany,
  count,
  findById,
  findByName,
  createRole,
  updateRole,
  deleteRolePermissions,
  deleteRole,
  countUsersWithRole,
};
