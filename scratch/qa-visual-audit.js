import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:5174'
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
]

const PAGES = [
  { path: '/', name: 'home' },
  { path: '/transport', name: 'transport' },
  { path: '/construction', name: 'construction' },
  { path: '/automobile', name: 'automobile' },
  { path: '/contact', name: 'contact' },
  { path: '/tickets/TCK-INTROUVABLE', name: 'ticket-notfound' },
  { path: '/agent', name: 'agent' },
  { path: '/nonexistent-page', name: '404' },
]

const browser = await chromium.launch()
const results = []

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  const page = await context.newPage()

  for (const p of PAGES) {
    try {
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle', timeout: 20000 })
      await page.waitForTimeout(1500)

      // Vérifier le débordement horizontal
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          hasOverflow: doc.scrollWidth > doc.clientWidth,
        }
      })

      // Vérifier les éléments visibles
      const navbarVisible = await page.locator('.navbar').isVisible().catch(() => false)
      const footerVisible = await page.locator('.footer').isVisible().catch(() => false)
      const heroVisible = await page.locator('.hero, .page-hero').isVisible().catch(() => false)

      // Capturer screenshot
      const shotPath = `scratch/screenshots/${vp.name}-${p.name}.png`
      await page.screenshot({ path: shotPath, fullPage: true })

      results.push({
        viewport: vp.name,
        page: p.name,
        overflow: overflow.hasOverflow,
        scrollWidth: overflow.scrollWidth,
        clientWidth: overflow.clientWidth,
        navbar: navbarVisible,
        footer: footerVisible,
        hero: heroVisible,
        screenshot: shotPath,
      })
    } catch (err) {
      results.push({
        viewport: vp.name,
        page: p.name,
        error: err.message,
      })
    }
  }
  await context.close()
}

await browser.close()

console.log('\n=== AUDIT VISUEL ===')
for (const r of results) {
  if (r.error) {
    console.log(`❌ [${r.viewport}] ${r.page}: ERROR ${r.error}`)
  } else {
    const issues = []
    if (r.overflow) issues.push(`OVERFLOW (${r.scrollWidth} > ${r.clientWidth})`)
    if (!r.navbar) issues.push('NO NAVBAR')
    if (!r.footer) issues.push('NO FOOTER')
    if (!r.hero) issues.push('NO HERO')
    console.log(`${issues.length ? '⚠️' : '✅'} [${r.viewport}] ${r.page}: ${issues.length ? issues.join(', ') : 'OK'} → ${r.screenshot}`)
  }
}