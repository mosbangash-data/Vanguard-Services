export const hasPermission = (user, permission) => Boolean(user?.permissions?.includes(permission))
export const hasRole = (user, ...roles) => roles.includes(user?.role)
export const hasDepartment = (user, department) => user?.department?.type === department
