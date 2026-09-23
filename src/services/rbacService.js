const prisma = require('../config/prisma');
const { getExpectedRolePermissions, normalizeRoleName } = require('../config/rbac');

const syncRolePermissionsForRole = async (roleName) => {
  const normalizedRoleName = normalizeRoleName(roleName);
  if (!normalizedRoleName) {
    return { synced: false, role: null, added: 0, removed: 0, permissions: [] };
  }

  const expectedPermissions = getExpectedRolePermissions(normalizedRoleName);
  const role = await prisma.role.findUnique({ where: { name: normalizedRoleName } });
  if (!role) {
    return { synced: false, role: normalizedRoleName, added: 0, removed: 0, permissions: expectedPermissions };
  }

  const permissionRecords = await prisma.permission.findMany({
    where: { name: { in: expectedPermissions } },
    select: { id: true, name: true },
  });
  const permissionMap = new Map(permissionRecords.map((permission) => [permission.name, permission.id]));
  const desiredIds = [...new Set(expectedPermissions.map((name) => permissionMap.get(name)).filter(Boolean))];

  const existingMappings = await prisma.rolePermission.findMany({
    where: { roleId: role.id },
    select: { permissionId: true },
  });
  const existingIds = new Set(existingMappings.map(({ permissionId }) => permissionId));

  const idsToAdd = desiredIds.filter((id) => !existingIds.has(id));
  const idsToRemove = [...existingIds].filter((permissionId) => !desiredIds.includes(permissionId));

  if (idsToAdd.length || idsToRemove.length) {
    await prisma.$transaction([
      ...(idsToRemove.length ? [prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: { in: idsToRemove } } })] : []),
      ...idsToAdd.map((permissionId) => prisma.rolePermission.upsert({
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
    removed: idsToRemove.length,
    permissions: expectedPermissions,
  };
};

const syncAllRolePermissions = async () => {
  const roleNames = Object.keys(require('../config/rbac').ROLE_PERMISSION_MAP);
  const results = await Promise.all(roleNames.map((roleName) => syncRolePermissionsForRole(roleName)));
  return results;
};

module.exports = { syncRolePermissionsForRole, syncAllRolePermissions };
