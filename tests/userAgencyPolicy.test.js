const test = require('node:test');
const assert = require('node:assert/strict');

const roles = {
  SUPER_ADMIN: { id: 'role-super', name: 'SUPER_ADMIN' },
  SERVICE_ADMIN: { id: 'role-service', name: 'SERVICE_ADMIN' },
  MANAGER: { id: 'role-manager', name: 'MANAGER' },
  AGENT: { id: 'role-agent', name: 'AGENT' },
};
const departments = {
  coach: { id: 'dept-coach', type: 'VANGUARD_COACH', name: 'Coach' },
  auto: { id: 'dept-auto', type: 'AUTO_SALES', name: 'Auto Sales' },
  construction: { id: 'dept-construction', type: 'CONSTRUCTION', name: 'Construction' },
};
const agencies = {
  activeCoach: { id: 'agency-coach', departmentId: 'dept-coach', isActive: true },
  activeCoachTwo: { id: 'agency-coach-2', departmentId: 'dept-coach', isActive: true },
  inactiveCoach: { id: 'agency-inactive', departmentId: 'dept-coach', isActive: false },
  activeAuto: { id: 'agency-auto', departmentId: 'dept-auto', isActive: true },
};

const prisma = {
  role: { findUnique: async ({ where }) => Object.values(roles).find((role) => role.id === where.id) || null },
  department: {
    findUnique: async ({ where }) => Object.values(departments).find((department) => department.id === where.id) || null,
    findMany: async ({ where }) => Object.values(departments).filter((department) => department.type === where.type).map(({ id }) => ({ id })),
  },
  agency: {
    findFirst: async ({ where }) => {
      const agency = agencies[Object.keys(agencies).find((key) => agencies[key].id === where.id)];
      if (!agency || agency.departmentId !== 'dept-coach' || (where.isActive && !agency.isActive)) return null;
      return agency;
    },
  },
};
let createdData;
let updatedData;
let existingUser;
const userRepository = {
  findByEmail: async () => null,
  createUser: async (data) => {
    createdData = data;
    return { ...data, id: 'new-user', role: roles[Object.keys(roles).find((name) => roles[name].id === data.roleId)], department: departments[Object.keys(departments).find((name) => departments[name].id === data.departmentId)] };
  },
  findById: async () => existingUser,
  updateUserById: async (_id, data) => {
    updatedData = data;
    return { ...existingUser, ...data, role: Object.values(roles).find((role) => role.id === (data.roleId || existingUser.roleId)), department: Object.values(departments).find((department) => department.id === (data.departmentId || existingUser.departmentId)) };
  },
};
const mock = (path, exports) => {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
mock('../src/config/prisma', prisma);
mock('../src/services/userRepository', userRepository);
mock('../src/services/auditService', { log: async () => {} });
mock('bcrypt', { hash: async () => 'test-hash' });
const userService = require('../src/services/userService');
const policy = require('../src/config/agencyAssignmentPolicy');

const superAdmin = { id: 'root', role: 'SUPER_ADMIN' };
const createInput = (roleId, departmentId, agencyId) => ({ firstName: 'Casey', lastName: 'Test', email: 'casey@example.test', roleId, departmentId, ...(agencyId === undefined ? {} : { agencyId }) });

test('Coach Agent and Manager require an active Coach agency; other role/departments do not', () => {
  assert.equal(policy.getAgencyAssignmentPolicy('AGENT', 'VANGUARD_COACH').required, true);
  assert.equal(policy.getAgencyAssignmentPolicy('MANAGER', 'VANGUARD_COACH').required, true);
  assert.equal(policy.getAgencyAssignmentPolicy('SUPER_ADMIN', 'VANGUARD_COACH').required, false);
  assert.equal(policy.getAgencyAssignmentPolicy('SERVICE_ADMIN', 'VANGUARD_COACH').required, false);
  assert.equal(policy.getAgencyAssignmentPolicy('AGENT', 'AUTO_SALES').required, false);
  assert.equal(policy.getAgencyAssignmentPolicy('SERVICE_ADMIN', 'CONSTRUCTION').required, false);
});

test('creating Coach Agent without an agency is refused', async () => {
  await assert.rejects(() => userService.createUser(createInput(roles.AGENT.id, departments.coach.id), superAdmin), { statusCode: 400 });
});

test('creating Coach Manager without an active valid agency is refused', async () => {
  await assert.rejects(() => userService.createUser(createInput(roles.MANAGER.id, departments.coach.id), superAdmin), { statusCode: 400 });
  await assert.rejects(() => userService.createUser(createInput(roles.MANAGER.id, departments.coach.id, agencies.inactiveCoach.id), superAdmin), { statusCode: 400 });
  await assert.rejects(() => userService.createUser(createInput(roles.MANAGER.id, departments.coach.id, agencies.activeAuto.id), superAdmin), { statusCode: 400 });
});

test('Super Admin and non-Coach staff can be created without a transport agency', async () => {
  await userService.createUser(createInput(roles.SUPER_ADMIN.id, departments.coach.id), superAdmin);
  assert.equal(createdData.agencyId, null);
  await userService.createUser(createInput(roles.AGENT.id, departments.auto.id), superAdmin);
  assert.equal(createdData.agencyId, null);
  await userService.createUser(createInput(roles.SERVICE_ADMIN.id, departments.construction.id), superAdmin);
  assert.equal(createdData.agencyId, null);
});

test('a Service Admin cannot assign a user outside the Service Admin department scope', async () => {
  await assert.rejects(() => userService.createUser(createInput(roles.AGENT.id, departments.auto.id), { id: 'coach-admin', role: 'SERVICE_ADMIN', department: { type: 'VANGUARD_COACH' } }), { statusCode: 403 });
});

test('changing Manager to Super Admin explicitly clears the old agency', async () => {
  existingUser = { id: 'target', firstName: 'M', lastName: 'C', email: 'm@example.test', roleId: roles.MANAGER.id, departmentId: departments.coach.id, role: roles.MANAGER, department: departments.coach, agencyId: agencies.activeCoach.id, agency: agencies.activeCoach };
  await userService.updateUser('target', { roleId: roles.SUPER_ADMIN.id, departmentId: departments.coach.id, agencyId: null }, superAdmin);
  assert.equal(updatedData.agencyId, null);
  assert.equal(updatedData.roleId, roles.SUPER_ADMIN.id);
});

test('changing to a role that requires an agency requires a fresh valid selection', async () => {
  existingUser = { id: 'target', firstName: 'S', lastName: 'A', email: 's@example.test', roleId: roles.SUPER_ADMIN.id, departmentId: departments.coach.id, role: roles.SUPER_ADMIN, department: departments.coach, agencyId: null, agency: null };
  await assert.rejects(() => userService.updateUser('target', { roleId: roles.MANAGER.id, departmentId: departments.coach.id }, superAdmin), { statusCode: 400 });
  await assert.rejects(() => userService.updateUser('target', { roleId: roles.MANAGER.id, departmentId: departments.coach.id, agencyId: agencies.inactiveCoach.id }, superAdmin), { statusCode: 400 });
  await userService.updateUser('target', { roleId: roles.MANAGER.id, departmentId: departments.coach.id, agencyId: agencies.activeCoach.id }, superAdmin);
  assert.equal(updatedData.agencyId, agencies.activeCoach.id);
});

test('a Manager can be reassigned to another active agency in the same Coach department', async () => {
  existingUser = { id: 'target', firstName: 'M', lastName: 'C', email: 'm@example.test', roleId: roles.MANAGER.id, departmentId: departments.coach.id, role: roles.MANAGER, department: departments.coach, agencyId: agencies.activeCoach.id, agency: agencies.activeCoach };
  await userService.updateUser('target', { roleId: roles.MANAGER.id, departmentId: departments.coach.id, agencyId: agencies.activeCoachTwo.id }, superAdmin);
  assert.equal(updatedData.agencyId, agencies.activeCoachTwo.id);
});

test('changing from Coach Manager to Auto Sales Agent removes the Coach agency', async () => {
  existingUser = { id: 'target', firstName: 'M', lastName: 'C', email: 'm@example.test', roleId: roles.MANAGER.id, departmentId: departments.coach.id, role: roles.MANAGER, department: departments.coach, agencyId: agencies.activeCoach.id, agency: agencies.activeCoach };
  await userService.updateUser('target', { roleId: roles.AGENT.id, departmentId: departments.auto.id, agencyId: null }, superAdmin);
  assert.equal(updatedData.agencyId, null);
});
