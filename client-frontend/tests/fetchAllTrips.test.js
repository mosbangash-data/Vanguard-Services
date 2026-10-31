import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchAllTrips } from '../src/utils/fetchAllTrips.js'

const trip = (id) => ({ id })

test('loads every ordinary page and deduplicates trip ids', async () => {
  const calls = []
  const items = await fetchAllTrips(async ({ page }) => {
    calls.push(page)
    return { total: 3, items: page === 1 ? [trip('a'), trip('b')] : [trip('b'), trip('c')] }
  })
  assert.deepEqual(calls, [1, 2])
  assert.deepEqual(items.map((entry) => entry.id), ['a', 'b', 'c'])
})

test('rejects repeated pages, empty unexpected pages, and changing totals', async () => {
  await assert.rejects(fetchAllTrips(async ({ page }) => ({ total: 3, items: page === 1 ? [trip('a')] : [trip('a')] })), /TRIP_PAGINATION_REPEATED_PAGE/)
  await assert.rejects(fetchAllTrips(async ({ page }) => ({ total: 2, items: page === 1 ? [trip('a')] : [] })), /TRIP_PAGINATION_INCOMPLETE/)
  await assert.rejects(fetchAllTrips(async ({ page }) => ({ total: page === 1 ? 3 : 4, items: [trip(`id-${page}`)] })), /TRIP_PAGINATION_TOTAL_CHANGED/)
})

test('rejects duplicate ids that cannot satisfy the announced total', async () => {
  await assert.rejects(fetchAllTrips(async ({ page }) => ({ total: 4, items: page === 1 ? [trip('a'), trip('b')] : page === 2 ? [trip('b'), trip('c')] : [] })), /TRIP_PAGINATION_INCOMPLETE/)
})

test('stops at the configured page safety limit', async () => {
  let calls = 0
  await assert.rejects(fetchAllTrips(async () => { calls += 1; return { total: 100, items: [trip(`id-${calls}`)] } }, {}, { maxPages: 2 }), /TRIP_PAGINATION_PAGE_LIMIT/)
  assert.equal(calls, 2)
})
