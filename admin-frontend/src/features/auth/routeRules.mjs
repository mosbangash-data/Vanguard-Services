export const isCoachDepartmentUser = (user) => user?.department?.type === 'VANGUARD_COACH' || user?.departmentType === 'VANGUARD_COACH';

export const getDestination = (user) => {
  if (!user) return '/admin/login';

  if (user.role === 'SUPER_ADMIN') {
    return '/admin';
  }

  if (user.role === 'AGENT' && isCoachDepartmentUser(user)) {
    return '/transport/agent';
  }

  if ((user.role === 'SERVICE_ADMIN' || user.role === 'MANAGER') && isCoachDepartmentUser(user)) {
    return '/transport';
  }

  switch (user.department?.type || user.departmentType) {
    case 'VANGUARD_COACH':
      return '/transport';
    case 'CONSTRUCTION':
      return '/construction';
    case 'AUTO_SALES':
      return '/automobile';
    default:
      return '/admin/login';
  }
};
