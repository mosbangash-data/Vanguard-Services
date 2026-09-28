const resourceKeys = {
  '/admin/users': ['users', 'users'], '/admin/roles': ['roles', 'roles'], '/admin/permissions': ['permissions', 'permissions'], '/admin/departments': ['departments', 'departments'], '/admin/audit': ['audit', 'audit'], '/admin/notifications': ['notifications', 'notifications'],
  '/transport/agencies': ['agencies', 'agencies'], '/transport/buses': ['buses', 'buses'], '/transport/drivers': ['drivers', 'drivers'], '/transport/destinations': ['destinations', 'destinations'], '/transport/schedules': ['schedules', 'schedules'], '/transport/trips': ['trips', 'trips'], '/transport/reservations': ['reservations', 'reservations'], '/transport/payments': ['payments', 'payments'], '/transport/tickets': ['tickets', 'tickets'], '/transport/parcels': ['parcels', 'parcels'],
  '/automobile/vehicles': ['vehicles', 'vehicles'], '/automobile/templates': ['vehicleTemplates', 'vehicleTemplates'], '/automobile/reservations': ['reservations', 'reservations'], '/automobile/payments': ['payments', 'payments'], '/automobile/sales': ['sales', 'sales'], '/construction/projects': ['projects', 'projects'], '/construction/templates': ['projectTemplates', 'projectTemplates'], '/construction/customer-requests': ['customerRequests', 'customerRequests'], '/construction/quote-requests': ['quoteRequests', 'quoteRequests'],
}

export const getResourceTitle = (t, resource) => {
  const [key] = resourceKeys[resource?.path] || []
  return key ? t(`navigation.items.${key}`) : resource?.label
}

export const getResourceSingular = (t, resource) => {
  const [, key] = resourceKeys[resource?.path] || []
  if (!key) return t('resourceUi.item')
  const translated = t(`resourceSingular.${key}`)
  return translated.startsWith('resourceSingular.') ? t('resourceUi.item') : translated
}
