const validateCreate = (body) => {
  if (!body) return 'Request body is required';
  if (!body.departmentId) return 'departmentId is required';
  if (!body.code) return 'code is required';
  if (!body.departureCity) return 'departureCity is required';
  if (!body.arrivalCity) return 'arrivalCity is required';
  return null;
};

module.exports = { validateCreate };
