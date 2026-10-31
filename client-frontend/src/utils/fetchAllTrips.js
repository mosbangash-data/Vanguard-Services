export async function fetchAllTrips(searchTrips, filters = {}, { limit = 50, maxPages = 200 } = {}) {
  const byId = new Map()
  const signatures = new Set()
  let expectedTotal = null
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await searchTrips({
      departure: filters.from?.trim() || undefined,
      arrival: filters.to?.trim() || undefined,
      date: filters.date || undefined,
      page,
      limit,
    })
    const items = result?.items || []
    const total = Number(result?.total)
    if (!Number.isInteger(total) || total < 0) throw new Error('TRIP_PAGINATION_INVALID_TOTAL')
    if (expectedTotal === null) expectedTotal = total
    if (total !== expectedTotal) throw new Error('TRIP_PAGINATION_TOTAL_CHANGED')
    if (!items.length) {
      if (byId.size < expectedTotal) throw new Error('TRIP_PAGINATION_INCOMPLETE')
      return [...byId.values()]
    }
    const ids = items.map((trip) => trip?.id)
    if (ids.some((id) => typeof id !== 'string' || !id)) throw new Error('TRIP_PAGINATION_INVALID_ITEM')
    const signature = ids.join('|')
    if (signatures.has(signature)) throw new Error('TRIP_PAGINATION_REPEATED_PAGE')
    signatures.add(signature)
    items.forEach((trip) => byId.set(trip.id, trip))
    if (byId.size >= expectedTotal) {
      if (byId.size !== expectedTotal) throw new Error('TRIP_PAGINATION_TOTAL_MISMATCH')
      return [...byId.values()]
    }
  }
  throw new Error('TRIP_PAGINATION_PAGE_LIMIT')
}
