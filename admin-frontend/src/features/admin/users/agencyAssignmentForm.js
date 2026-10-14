export const getAgencyAssignmentForSelection = (roles, departments, roleId, departmentId) => {
  const role = roles.find((item) => item.id === roleId)
  const department = departments.find((item) => item.id === departmentId)
  return role?.agencyAssignmentPolicies?.[department?.type] || { allowed: false, required: false }
}

export const reconcileRoleSelection = (form, roleId, roles, departments) => {
  const role = roles.find((item) => item.id === roleId)
  const department = departments.find((item) => item.id === form.departmentId)
  return {
    ...form,
    roleId,
    departmentId: role && department && !role.departmentTypes?.includes(department.type) ? '' : form.departmentId,
    agencyId: '',
  }
}

export const reconcileDepartmentSelection = (form, departmentId, roles, departments) => {
  const role = roles.find((item) => item.id === form.roleId)
  const department = departments.find((item) => item.id === departmentId)
  return {
    ...form,
    departmentId,
    roleId: role && department && !role.departmentTypes?.includes(department.type) ? '' : form.roleId,
    agencyId: '',
  }
}

export const buildAgencyAwareUserPayload = (form, policy, { clearDisallowed = false } = {}) => {
  const { agencyId, ...fields } = form
  if (policy?.allowed) return { ...fields, agencyId: agencyId || null }
  return clearDisallowed ? { ...fields, agencyId: null } : fields
}
