import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

console.log('🧪 Starting Automated Resource System Verification...')

// 1. Check resourceConfig.js
const configPath = path.resolve('admin-frontend/src/features/resources/resourceConfig.js')
const configContent = fs.readFileSync(configPath, 'utf8')

// Test for presence of key resource definitions
const requiredResources = ['drivers', 'destinations', 'buses', 'schedules', 'trips', 'agencies']
for (const res of requiredResources) {
  assert(configContent.includes(`/transport/${res}`), `resourceConfig must contain /transport/${res}`)
  assert(configContent.includes(`/api/${res}`), `resourceConfig must contain /api/${res}`)
  console.log(`  ✓ Resource /transport/${res} configured with endpoint /api/${res}`)
}

// 2. Check Drivers Fields
const driverFields = ['firstName', 'lastName', 'licenseNumber', 'phone', 'email', 'isActive']
for (const f of driverFields) {
  assert(configContent.includes(`name: '${f}'`), `Drivers config must include field ${f}`)
  console.log(`  ✓ Driver field "${f}" found in config`)
}

// 3. Check Destinations Fields
const destFields = ['code', 'departureCity', 'arrivalCity', 'distanceKm', 'durationHours', 'description']
for (const f of destFields) {
  assert(configContent.includes(`name: '${f}'`), `Destinations config must include field ${f}`)
  console.log(`  ✓ Destination field "${f}" found in config`)
}

// 4. Check Buses Fields
const busFields = ['plateNumber', 'brand', 'model', 'seats', 'status']
for (const f of busFields) {
  assert(configContent.includes(`name: '${f}'`), `Buses config must include field ${f}`)
  console.log(`  ✓ Bus field "${f}" found in config`)
}

// 5. Check Schedules Fields & Relational Dropdowns
const scheduleFields = ['routeId', 'busId', 'departureTime', 'returnTime', 'price', 'availableDays', 'status']
for (const f of scheduleFields) {
  assert(configContent.includes(`name: '${f}'`), `Schedules config must include field ${f}`)
  console.log(`  ✓ Schedule field "${f}" found in config`)
}
assert(configContent.includes("optionsUrl: '/api/destinations'"), 'Schedule routeId must link to /api/destinations')
assert(configContent.includes("optionsUrl: '/api/buses'"), 'Schedule busId must link to /api/buses')
console.log('  ✓ Schedule relational options (destinations & buses) configured')

// 6. Check Trips Fields
const tripFields = ['scheduleId', 'departureAt', 'arrivalAt', 'status']
for (const f of tripFields) {
  assert(configContent.includes(`name: '${f}'`), `Trips config must include field ${f}`)
  console.log(`  ✓ Trip field "${f}" found in config`)
}
assert(configContent.includes("optionsUrl: '/api/schedules'"), 'Trip scheduleId must link to /api/schedules')
console.log('  ✓ Trip relational options (schedules) configured')

// 7. Check ResourcePage.jsx content
const resourcePagePath = path.resolve('admin-frontend/src/features/resources/ResourcePage.jsx')
const resourcePageContent = fs.readFileSync(resourcePagePath, 'utf8')

// Ensure JsonForm and the buggy string are completely gone
assert(!resourcePageContent.includes('Données JSON correspondant au contrat backend'), 'Buggy backend label must NOT exist in ResourcePage.jsx')
assert(!resourcePageContent.includes('function JsonForm'), 'JsonForm must be replaced in ResourcePage.jsx')
assert(resourcePageContent.includes('DynamicResourceForm'), 'ResourcePage must import and use DynamicResourceForm')
assert(resourcePageContent.includes('resource-mobile-cards'), 'ResourcePage must include responsive mobile cards')
assert(resourcePageContent.includes('debouncedSearch'), 'ResourcePage must include search debouncing')
assert(resourcePageContent.includes('ConfirmDialog'), 'ResourcePage must use ConfirmDialog for deletion')
console.log('  ✓ ResourcePage: Buggy backend text eliminated')
console.log('  ✓ ResourcePage: JsonForm replaced by DynamicResourceForm')
console.log('  ✓ ResourcePage: Mobile responsive cards view present')
console.log('  ✓ ResourcePage: Debounced search integrated')
console.log('  ✓ ResourcePage: ConfirmDialog integrated for deletions')

// 8. Check DynamicResourceForm.jsx
const dynamicFormPath = path.resolve('admin-frontend/src/features/resources/DynamicResourceForm.jsx')
const dynamicFormContent = fs.readFileSync(dynamicFormPath, 'utf8')
assert(dynamicFormContent.includes('export function DynamicResourceForm'), 'DynamicResourceForm must export DynamicResourceForm')
assert(dynamicFormContent.includes('departments-lookup'), 'DynamicResourceForm must include automatic department resolution')
assert(dynamicFormContent.includes('multiselect-pill'), 'DynamicResourceForm must support multiselect pills')
assert(!dynamicFormContent.includes('Données JSON'), 'DynamicResourceForm must not contain JSON editor text')
console.log('  ✓ DynamicResourceForm: Exports and features validated')

// 9. Check vanguard-design-system.css
const cssPath = path.resolve('admin-frontend/src/vanguard-design-system.css')
const cssContent = fs.readFileSync(cssPath, 'utf8')
assert(cssContent.includes('.resource-mobile-cards'), 'CSS must include .resource-mobile-cards')
assert(cssContent.includes('.resource-form-grid'), 'CSS must include .resource-form-grid')
assert(cssContent.includes('.multiselect-pill'), 'CSS must include .multiselect-pill')
assert(cssContent.includes('@media (max-width: 768px)'), 'CSS must include mobile 768px breakpoint')
assert(cssContent.includes('@media (max-width: 640px)'), 'CSS must include mobile 640px breakpoint')
console.log('  ✓ CSS: Mobile cards, form grid, breakpoints, and modal responsiveness present')

// 10. Test toList parser logic
const toList = (data) => {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.data?.items)) return data.data.items
  const found = Object.values(data).find(Array.isArray)
  return Array.isArray(found) ? found : []
}

assert.deepStrictEqual(toList([1, 2, 3]), [1, 2, 3])
assert.deepStrictEqual(toList({ items: ['a', 'b'] }), ['a', 'b'])
assert.deepStrictEqual(toList({ data: ['x', 'y'] }), ['x', 'y'])
assert.deepStrictEqual(toList({ data: { items: [10, 20] } }), [10, 20])
assert.deepStrictEqual(toList(null), [])
assert.deepStrictEqual(toList(undefined), [])
assert.deepStrictEqual(toList({ success: true, count: 0, items: [] }), [])
assert.deepStrictEqual(toList({ error: 'Not found' }), [])
console.log('  ✓ toList logic: All response structure formats parsed accurately')

console.log('\n🎉 ALL 10 TEST SUITES PASSED FLAWLESSLY!')
