const validateCreate = (body) => {
  if (!body) return 'Request body is required';
  if (!body.departmentId) return 'departmentId is required';
  if (!body.plateNumber) return 'plateNumber is required';
  if (!body.brand) return 'brand is required';
  if (!body.model) return 'model is required';
  if (!body.seats) return 'seats is required';
  return null;
};

module.exports = { validateCreate };
