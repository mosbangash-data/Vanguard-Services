const COACH = 'VANGUARD_COACH';

// Agency ownership is needed by Coach field roles only. Department administrators
// are scoped by department, and other services use their own organization model.
const AGENCY_BOUND_ROLES = new Set([`AGENT:${COACH}`, `MANAGER:${COACH}`]);

const getAgencyAssignmentPolicy = (roleName, departmentType) => {
  const key = `${String(roleName || '').trim().toUpperCase()}:${String(departmentType || '').trim().toUpperCase()}`;
  const required = AGENCY_BOUND_ROLES.has(key);
  return {
    allowed: required,
    required,
    departmentType: required ? COACH : null,
    requireActive: required,
    canCreateWithoutAgency: !required,
    canChangeAgency: required,
  };
};

module.exports = { getAgencyAssignmentPolicy, AGENCY_BOUND_ROLES };
