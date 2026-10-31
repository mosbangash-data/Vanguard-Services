import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const browser = await chromium.launch({ headless: true })
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const page = await browser.newPage({ viewport })
    page.on('pageerror', (error) => console.error('pageerror:', error.message))
    page.on('console', (message) => { if (message.type() === 'error') console.error('console:', message.text()) })
    let slowTrips = false
    let releaseTrips
    const tripsReady = new Promise((resolve) => { releaseTrips = resolve })
    await page.route('**/api/public/trips**', async (route) => {
      if (slowTrips) await delay(700)
      releaseTrips()
      const url = new URL(route.request().url())
      const pageNum = Number(url.searchParams.get('page') || 1)
      const all = [{ id: 'trip-a', departureAt: '2027-02-10T06:30:00.000Z', arrivalAt: '2027-02-10T10:30:00.000Z', status: 'SCHEDULED', route: { departureCity: 'Goma', arrivalCity: 'Dar Es Salaam' }, schedule: { departureTime: '07:30', price: '50', currency: 'USD', timeZone: 'Africa/Kinshasa' }, bus: { seats: 40 }, availableSeats: 12 }]
      const payload = { success: true, data: { items: pageNum === 1 ? all : [], page: pageNum, limit: 50, total: 1 } }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) })
    })
    await page.route('**/*', (route) => {
      const pathname = new URL(route.request().url()).pathname
      if (!pathname.startsWith('/api/')) return route.fallback()
      if (pathname === '/api/public/trips') return route.fallback()
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], page: 1, limit: 20, total: 0 } }) })
    })
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)
    if (!(await page.locator('.hero-routes-list').count())) console.error('page content:', (await page.locator('body').innerText()).slice(0, 1200))
    assert.match(await page.locator('.hero-routes-list').innerText(), /Goma - Dar Es Salaam/)
    assert.match(await page.locator('.hero-routes-list').innerText(), /Bukavu - Dar Es Salaam/)
    assert.match(await page.locator('.hero-actions').innerText(), /Faire ma réservation/i)
    assert.match(await page.locator('.hero-actions').innerText(), /Voir les horaires/i)
    const languageButton = viewport.width <= 860 ? '.navbar-mobile-lang .lang-switcher' : '.navbar-desktop-actions .lang-switcher'
    if (viewport.width <= 860) await page.getByRole('button', { name: /Menu/i }).click()
    await page.locator(languageButton).click()
    assert.match(await page.locator('.hero-actions').innerText(), /Make a booking/i)
    await page.locator(languageButton).click()
    slowTrips = true
    await page.goto('http://127.0.0.1:5173/transport#horaires', { waitUntil: 'domcontentloaded' })
    await tripsReady
    await page.waitForSelector('.trip-card')
    assert.equal(await page.locator('#horaires').count(), 1)
    await page.waitForFunction(() => {
      const rect = document.getElementById('horaires')?.getBoundingClientRect()
      return rect && rect.top >= 60 && rect.top < 170
    })
    await page.goto('http://127.0.0.1:5173/transport#reservation', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => {
      const rect = document.getElementById('reservation')?.getBoundingClientRect()
      return rect && rect.top >= 60 && rect.top < 170
    })
    await page.goto('http://127.0.0.1:5173/')
    await page.getByRole('link', { name: /Faire ma réservation|Make a booking/i }).click()
    await page.waitForURL('**/transport#reservation')
    await page.waitForSelector('.trip-card')
    await page.waitForFunction(() => {
      const rect = document.getElementById('reservation')?.getBoundingClientRect()
      return rect && rect.top >= 60 && rect.top < 170
    })
    assert.equal(await page.locator('.trip-card').count(), 1)
    assert.match(await page.locator('.trip-card').innerText(), /07:30/)
    if (viewport.width <= 860) {
      await page.getByRole('button', { name: /Menu/i }).click()
      assert.equal(await page.locator('.navbar-mobile-open').count(), 1)
      await page.locator('.navbar-mobile-group .navbar-mobile-link').first().click()
      await page.waitForURL('**/transport/about')
      await page.waitForFunction(() => !document.querySelector('.navbar-mobile-open'))
    } else {
      await page.locator('.navbar-about-trigger').click()
      assert.equal(await page.locator('.navbar-about-menu a').count(), 2)
    }
    await page.close()
  }
  console.log('UI smoke passed at mobile, tablet, desktop viewports')
} finally { await browser.close() }
