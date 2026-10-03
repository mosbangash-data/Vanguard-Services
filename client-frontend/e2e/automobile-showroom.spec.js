import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.error('PAGE ERROR:', error.message))
  page.on('console', (message) => { if (message.type() === 'error') console.error('PAGE CONSOLE:', message.text()) })
})

const vehicles = [
  {
    id: 'vehicle-land-rover', brand: 'Land Rover', model: 'Defender', year: 2022, mileage: 18000,
    fuelType: 'Diesel', transmission: 'Automatic', color: 'Green', price: '12500.50', currency: 'USD',
    status: 'AVAILABLE', description: 'Four wheel drive',
    media: [
      { id: 'primary', isPrimary: true, order: 0, caption: 'Front view', media: { id: 'img-1', url: 'https://res.cloudinary.com/demo/image/upload/v123/front.jpg', mimeType: 'image/jpeg' } },
      { id: 'secondary', order: 1, caption: 'Side view', media: { id: 'img-2', url: 'https://res.cloudinary.com/demo/image/upload/v123/side.jpg', mimeType: 'image/jpeg' } },
    ],
  },
  {
    id: 'vehicle-toyota', brand: 'Toyota', model: 'Corolla', year: 2020, mileage: 42000,
    fuelType: 'Petrol', transmission: 'Manual', price: '0', currency: 'CDF', status: 'AVAILABLE', media: [],
  },
]

async function mockClientApi(page, { failVehicles = false } = {}) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/vehicles' && route.request().method() === 'GET') {
      if (failVehicles) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'internal detail' }) })
      const query = (url.searchParams.get('search') || '').toLowerCase()
      const matches = vehicles.filter((vehicle) => `${vehicle.brand} ${vehicle.model} ${vehicle.description || ''}`.toLowerCase().includes(query))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: matches, total: matches.length, page: 1, limit: 50 } }) })
    }
    if (url.pathname.startsWith('/api/vehicles/') && route.request().method() === 'GET') {
      const vehicle = vehicles.find((item) => item.id === url.pathname.split('/').at(-1))
      return route.fulfill({ status: vehicle ? 200 : 404, contentType: 'application/json', body: JSON.stringify({ success: Boolean(vehicle), data: vehicle ? { vehicle } : null }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) })
  })
  await page.route('https://res.cloudinary.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="6"><rect width="8" height="6" fill="#334155"/></svg>' }))
}

test('showroom searches and filters actual vehicle fields, and reset restores the list', async ({ page }) => {
  await mockClientApi(page)
  await page.goto('/automobile')
  await expect(page.locator('.vehicle-card')).toHaveCount(2)
  await expect(page.locator('.automobile-hero h1')).toBeVisible()
  await expect(page.locator('.vehicle-card-price').nth(1)).toContainText(/request/i)

  await page.locator('.vehicle-filter-field select').nth(0).selectOption('Toyota')
  await expect(page.locator('.vehicle-card')).toHaveCount(1)
  await expect(page.locator('.vehicle-card-title')).toContainText('Corolla')
  await page.getByRole('button', { name: /reset filters/i }).click()
  await expect(page.locator('.vehicle-card')).toHaveCount(2)

  await page.getByRole('searchbox').fill('Defender')
  await expect(page.locator('.vehicle-card')).toHaveCount(1)
  await expect(page.locator('.vehicle-card-title')).toContainText('Defender')
})

test('detail uses the shared gallery and WhatsApp link with localized vehicle reference', async ({ page }) => {
  await mockClientApi(page)
  await page.goto('/automobile/vehicles/vehicle-land-rover')
  await expect(page.getByRole('heading', { name: 'Land Rover Defender' })).toBeVisible()
  await expect(page.locator('.media-gallery-thumbnails button')).toHaveCount(2)

  const whatsapp = page.getByRole('link', { name: /contact on whatsapp/i })
  const href = new URL(await whatsapp.getAttribute('href'))
  expect(href.hostname).toBe('wa.me')
  expect(href.searchParams.get('text')).toContain('Land Rover Defender')
  expect(href.searchParams.get('text')).toContain('vehicle-land-rover')

  const expand = page.getByRole('button', { name: 'View fullscreen' })
  await expand.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.media-lightbox .media-gallery-counter')).toHaveText('2 / 2')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.media-lightbox .media-gallery-counter')).toHaveText('1 / 2')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(expand).toBeFocused()
})

test('API errors use a translated public error state instead of backend response text', async ({ page }) => {
  await mockClientApi(page, { failVehicles: true })
  await page.goto('/automobile')
  await expect(page.getByText('Could not load vehicles. Please try again.')).toBeVisible()
  await expect(page.getByText('internal detail')).toHaveCount(0)
})

test('showroom has no horizontal overflow at narrow mobile widths', async ({ page }) => {
  await mockClientApi(page)
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/automobile')
    await expect(page.locator('.vehicle-card').first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false)
  }
})
