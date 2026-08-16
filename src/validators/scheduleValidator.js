const validateCreate = (body) => {
  if (!body) return 'Request body is required';
  if (!body.departmentId) return 'departmentId is required';
  if (!body.routeId) return 'routeId is required';
  if (!body.busId) return 'busId is required';
  if (!body.departureTime) return 'departureTime is required';
  if (!Array.isArray(body.availableDays) || body.availableDays.length === 0) return 'availableDays is required';
  if (body.price === undefined || body.price === null) return 'price is required';
  return null;
};

module.exports = { validateCreate };
