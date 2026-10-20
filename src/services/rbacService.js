const prisma = require('../config/prisma');
const { getExpectedRolePermissions, normalizeRoleName } = require('../config/rbac');

const syncRolePermissionsForRole = async (roleName, prismaClient = prisma) => {
  const normalizedRoleName = normalizeRoleName(roleName);
  if (!normalizedRoleName) {
    return { synced: false, role: null, added: 0, removed: 0, permissions: [] };
  }

  const expectedPermissions = getExpectedRolePermissions(normalizedRoleName);
  const role = await prismaClient.role.findUnique({ where: { name: normalizedRoleName } });
  if (!role) {
    return { synced: false, role: normalizedRoleName, added: 0, removed: 0, permissions: expectedPermissions };
  }

  const permissionRecords = await prismaClient.permission.findMany({
    where: { name: { in: expectedPermissions } },
    select: { id: true, name: true },
  });
  const permissionMap = new Map(permissionRecords.map((permission) => [permission.name, permission.id]));
  const desiredIds = [...new Set(expectedPermissions.map((name) => permissionMap.get(name)).filter(Boolean))];

  const existingMappings = await prismaClient.rolePermission.findMany({
    where: { roleId: role.id },
    select: { permissionId: true },
  });
  const existingIds = new Set(existingMappings.map(({ permissionId }) => permissionId));

  const idsToAdd = desiredIds.filter((id) => !existingIds.has(id));
  if (idsToAdd.length) {
    await prismaClient.$transaction([
      ...idsToAdd.map((permissionId) => prismaClient.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      })),
    ]);
  }

  return {
    synced: true,
    role: normalizedRoleName,
    added: idsToAdd.length,
    removed: 0,
    permissions: expectedPermissions,
  };
};

const syncAllRolePermissions = async (prismaClient = prisma) => {
  const roleNames = Object.keys(require('../config/rbac').ROLE_PERMISSION_MAP);
  const results = await Promise.all(roleNames.map((roleName) => syncRolePermissionsForRole(roleName, prismaClient)));
  return results;
};

module.exports = { syncRolePermissionsForRole, syncAllRolePermissions };
