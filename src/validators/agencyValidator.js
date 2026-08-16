const validateCreate = (body) => {
  if (!body) return 'Request body is required';
  if (!body.name || typeof body.name !== 'string') return 'name is required';
  if (!body.code || typeof body.code !== 'string') return 'code is required';
  if (!body.departmentId || typeof body.departmentId !== 'string') return 'departmentId is required';
  return null;
};

module.exports = { validateCreate };
