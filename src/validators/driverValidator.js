const validateCreate = (body) => {
  if (!body) return 'Request body is required';
  if (!body.departmentId) return 'departmentId is required';
  if (!body.firstName) return 'firstName is required';
  if (!body.lastName) return 'lastName is required';
  if (!body.licenseNumber) return 'licenseNumber is required';
  return null;
};

module.exports = { validateCreate };
