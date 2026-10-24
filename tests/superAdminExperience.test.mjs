import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { buildSuperAdminNavigation } from '../admin-frontend/src/features/admin/superAdminNavigation.mjs'
import { apiErrorMessage } from '../admin-frontend/src/utils/apiErrorMessage.mjs'
import { buildParcelCreatePayload } from '../admin-frontend/src/features/resources/parcelFormWorkflow.mjs'

const require = createRequire(import.meta.url)
const { validateCreate } = require('../src/validators/parcelValidator')
const { requirePermission } = require('../src/middleware/permissionMiddleware')

const t = (key) => key
const icons = new Proxy({}, { get: (_target, key) => key })

test('Super Admin sidebar has the six required main sections and one account destination', () => {
  const sections = buildSuperAdminNavigation({ t, can: () => true, icons })
  assert.deepEqual(sections.map(({ title }) => title), [
    'superAdminNav.dashboard',
    'superAdminNav.users',
    'superAdminNav.coach',
    'superAdminNav.autoSales',
    'superAdminNav.construction',
    'superAdminNav.account',
  ])
  assert.equal(sections.filter(({ standalone }) => standalone?.path === '/admin/account').length, 1)
})

test('restricted permissions remove only the corresponding Super Admin submenu links', () => {
  const sections = buildSuperAdminNavigation({ t, can: (permission) => permission !== 'VIEW_PARCEL', icons })
  const coach = sections.find(({ id }) => id === 'super-coach')
  assert.equal(coach.items.some(({ path }) => path === '/transport/parcels'), false)
  assert.equal(coach.items.some(({ path }) => path === '/transport/agencies'), true)
})

test('API errors are mapped to safe translated messages without exposing server details', () => {
  const error = (status, message) => ({ response: { status, data: { message } } })
  const translate = (key) => key
  assert.equal(apiErrorMessage(error(403, 'permission denied internals'), translate), 'apiErrors.forbidden')
  assert.equal(apiErrorMessage(error(401, 'token detail'), translate), 'apiErrors.unauthorized')
  assert.equal(apiErrorMessage(error(404, 'path /secret'), translate), 'apiErrors.notFound')
  assert.equal(apiErrorMessage(error(409, 'private conflict detail'), translate), 'apiErrors.conflict')
  assert.equal(apiErrorMessage(error(429, 'rate limit metadata'), translate), 'apiErrors.rateLimited')
  assert.equal(apiErrorMessage(error(400, 'internal parser message'), translate), 'apiErrors.invalidRequest')
  assert.equal(apiErrorMessage(error(500, 'SQL host and query'), translate), 'apiErrors.server')
  assert.equal(apiErrorMessage(error(422, 'database validation trace'), translate), 'apiErrors.invalidRequest')
})

test('route-local ErrorBoundary resets on navigation and does not print exception detail in production UI', async () => {
  const layout = await readFile(new URL('../admin-frontend/src/layouts/AdminLayout.jsx', import.meta.url), 'utf8')
  const boundary = await readFile(new URL('../admin-frontend/src/components/ui/ErrorBoundary.jsx', import.meta.url), 'utf8')
  assert.match(layout, /key=\{location\.pathname\}/)
  assert.match(layout, /<Outlet \/>/)
  assert.match(layout, /homePath=\{isSuperAdmin \? '\/admin'/)
  assert.doesNotMatch(boundary, /error\.message/)
})

test('parcel form uses the official quote endpoint and the backend CASH timing contract', async () => {
  const form = await readFile(new URL('../admin-frontend/src/features/resources/DynamicResourceForm.jsx', import.meta.url), 'utf8')
  const config = await readFile(new URL('../admin-frontend/src/features/resources/resourceConfig.jsx', import.meta.url), 'utf8')
  assert.match(form, /\/api\/parcels\/quote/)
  assert.match(form, /buildParcelCreatePayload\(payload, priceQuote\)/)
  assert.match(config, /name: 'paymentTiming'/)
  assert.match(config, /name: 'cashCollected'/)
  assert.match(config, /optionsDepartmentType: 'VANGUARD_COACH'/)
  assert.match(config, /disabledWhen: \(\) => true/)
  assert.match(form, /return optionDepartmentId \? \{ departmentId: optionDepartmentId \} : \{\}/)
})

test('parcel payload uses quote price, selected pricing basis and deposit cash confirmation', () => {
  const payload = buildParcelCreatePayload({
    senderName: 'A', recipientName: 'B', pricingBasis: 'VOLUME', weightKg: '7.5', volumeM3: '0.2',
    paymentTiming: 'AT_DEPOSIT', cashCollected: true,
  }, { amount: '17.25', currency: 'CDF' })
  assert.equal(payload.amount, '17.25')
  assert.equal(payload.currency, 'CDF')
  assert.equal(payload.paymentMethod, 'CASH')
  assert.equal(payload.weightKg, 0)
  assert.equal(payload.volumeM3, .2)
  assert.equal(payload.cashCollected, true)
  const pickup = buildParcelCreatePayload({ paymentTiming: 'AT_PICKUP', cashCollected: false, pricingBasis: 'WEIGHT', weightKg: '2' }, { amount: '6.50', currency: 'USD' })
  assert.equal(pickup.cashCollected, false)
  assert.equal(pickup.weightKg, 2)
  assert.equal(pickup.volumeM3, 0)
  const mobile = buildParcelCreatePayload({ paymentTiming: 'AT_DEPOSIT', paymentMethod: 'MOBILE_MONEY', cashCollected: false, pricingBasis: 'WEIGHT', weightKg: '2' }, { amount: '6.50', currency: 'USD' })
  assert.equal(mobile.paymentMethod, 'MOBILE_MONEY')
  assert.equal(mobile.cashCollected, false)
})

test('parcel creation validator accepts the actual contract and rejects missing fields or invalid prices', () => {
  const valid = {
    senderName: 'Sender', senderPhone: '+243800000001', recipientName: 'Recipient', recipientPhone: '+243800000002',
    originCity: 'Kinshasa', destinationAgencyId: 'destination-id', amount: '5.00', currency: 'USD',
    paymentTiming: 'AT_DEPOSIT', cashCollected: true, paymentMethod: 'CASH', weightKg: 1, volumeM3: 0,
  }
  const invoke = (body, user = { role: 'SUPER_ADMIN' }) => {
    let status
    let bodyOut
    let continued = false
    validateCreate({ body, user }, { status(value) { status = value; return this }, json(value) { bodyOut = value } }, () => { continued = true })
    return { status, bodyOut, continued }
  }
  assert.equal(invoke(valid).continued, true)
  assert.equal(invoke({ ...valid, paymentMethod: 'MOBILE_MONEY', cashCollected: false }).continued, true)
  assert.equal(invoke({ ...valid, amount: '0' }).status, 400)
  assert.equal(invoke({ ...valid, senderName: '' }).status, 400)
  assert.equal(invoke({ ...valid, destinationAgencyId: '', destinationCity: '' }).status, 400)
})

test('parcel create permission remains enforced by the backend middleware', () => {
  const guard = requirePermission('CREATE_PARCEL')
  let denied
  guard({ user: { role: 'AGENT', permissions: [] }, path: '/api/parcels' }, {}, (error) => { denied = error })
  assert.equal(denied.statusCode, 403)
  let continued = false
  guard({ user: { role: 'SUPER_ADMIN', permissions: ['CREATE_PARCEL'] }, path: '/api/parcels' }, {}, () => { continued = true })
  assert.equal(continued, true)
})
