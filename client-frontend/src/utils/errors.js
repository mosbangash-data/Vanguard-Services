/**
 * Traduit une erreur API en message utilisateur.
 * Les codes d'erreur génériques (INVALID_REQUEST, NOT_FOUND, etc.)
 * sont traduits via i18n. Les messages backend explicites sont
 * également traduits lorsqu'une clé correspond.
 */
export function translateError(err, t) {
  const message = err?.message || ''

  if (!t || typeof t !== 'function') {
    return message || 'Error'
  }

  // 1. Codes génériques produits par le client API
  const generic = t(`errors.${message}`)
  if (generic && generic !== `errors.${message}`) return generic

  // 2. Messages backend explicites
  const backend = t(`errors.${message}`)
  if (backend && backend !== `errors.${message}` && backend !== message) return backend

  // 3. Fallback générique selon le statut HTTP
  const status = err?.status
  if (status === 404) return t('errors.NOT_FOUND')
  if (status === 409) return t('errors.CONFLICT')
  if (status === 429) return t('errors.TOO_MANY_REQUESTS')
  if (status === 500) return t('errors.SERVER_ERROR')
  if (status === 400) return t('errors.INVALID_REQUEST')

  // 4. Dernier recours
  return message || t('states.error')
}