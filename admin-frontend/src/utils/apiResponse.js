export function normalizeListResponse(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.entries)) return payload.entries

  const found = Object.values(payload ?? {}).find(Array.isArray)
  return Array.isArray(found) ? found : []
}

export function unwrapApiResponse(response) {
  const payload = response && typeof response === 'object' && 'data' in response ? response.data : response
  if (!payload || typeof payload !== 'object') return payload
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.results)) return payload.results
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data
  }
  return payload
}

export function getRelationValue(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value
      .map((entry) => getRelationValue(entry))
      .filter((entry) => entry !== '' && entry !== null && entry !== undefined)
      .join(', ')
  }

  if (typeof value === 'object') {
    return value.id ?? value.value ?? value.uuid ?? value.code ?? value.name ?? value.label ?? ''
  }

  return ''
}
