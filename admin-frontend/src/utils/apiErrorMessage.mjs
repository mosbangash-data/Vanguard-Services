const STATUS_KEYS = {
  401: 'apiErrors.unauthorized',
  403: 'apiErrors.forbidden',
  404: 'apiErrors.notFound',
  422: 'apiErrors.invalidRequest',
  429: 'apiErrors.rateLimited',
}

export function apiErrorMessage(error, t, fallbackKey = 'resourceUi.operationFailed') {
  const status = error?.response?.status
  if (STATUS_KEYS[status]) return t(STATUS_KEYS[status])
  if (status >= 500) return t('apiErrors.server')
  if (status === 409) return t('apiErrors.conflict')
  if (status >= 400) return t('apiErrors.invalidRequest')
  return t(fallbackKey)
}
