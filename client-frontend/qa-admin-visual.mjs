import { chromium } from '@playwright/test'

const baseUrl = 'http://127.0.0.1:5173'
const apiUrl = 'http://127.0.0.1:3000'
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
]

async function sessionFor(identifier, password) {
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  const payload = await response.json()
  if (!response.ok || !payload?.data?.token) throw new Error(`Login failed for ${identifier}`)
  return payload.data
}

const accounts = {
  admin: await sessionFor('admin@vanguard.local', 'Admin123!'),
  construction: await sessionFor('construction@vanguard.local', 'Construction123!'),
  engineer: await sessionFor('engineer.a@vanguard.local', 'EngineerA123!'),
}
const routes = [
  ['admin', ['/admin', '/admin/users', '/admin/permissions']],
  ['construction', ['/construction', '/construction/projects']],
  ['engineer', ['/construction/engineer', '/construction/engineer/projects']],
]

const browser = await chromium.launch({ headless: true })
const findings = []

for (const viewport of viewports) {
  for (const [accountName, paths] of routes) {
    const context = await browser.newContext({ viewport })
    await context.addInitScript((session) => localStorage.setItem('vanguard.admin.session', JSON.stringify(session)), accounts[accountName])
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const path of paths) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' })
      await page.locator('.app-main').waitFor({ state: 'attached', timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(250)
      const audit = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasMain: Boolean(document.querySelector('.app-main')),
        hasSidebar: Boolean(document.querySelector('.sidebar')),
        hasVisibleContent: (document.querySelector('.app-main')?.innerText.trim().length || 0) > 0,
        overflowSources: [...document.querySelectorAll('body *')]
          .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
          .slice(0, 3)
          .map((element) => `${element.tagName}.${element.className}`),
      }))
      findings.push({ viewport: viewport.name, route: path, ...audit, errors: [...errors] })
    }
    await context.close()
  }
}

await browser.close()
const failed = findings.filter((item) => item.overflow || !item.hasMain || !item.hasSidebar || !item.hasVisibleContent || item.errors.length)
console.table(findings.map(({ errors, overflowSources, ...item }) => ({ ...item, errors: errors.length, overflowSources: overflowSources.join(', ') })))
if (failed.length) {
  console.error(`Visual QA failed for ${failed.length} route(s).`)
  process.exit(1)
}
console.log(`Visual QA passed for ${findings.length} authenticated route/viewport checks.`)
