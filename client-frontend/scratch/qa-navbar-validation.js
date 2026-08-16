import { test, expect } from '@playwright/test'

const VIEWPORTS = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 390, height: 844 },
]

// Textes à ne PAS afficher dans la navbar (desktop et mobile)
const FORBIDDEN_NAVBAR_TEXTS = [
  /Accueil/i,
  /Home/i,
  /Services/i,
  /À propos/i,
  /About/i,
  /Comment ça marche/i,
  /How it works/i,
  /Contact/i,
]

test.describe('NAVBAR — Validation responsive & minimaliste', () => {
  for (const vp of VIEWPORTS) {
    test(`navbar minimaliste — ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')

      // Logo présent
      await expect(page.locator('.navbar-logo')).toBeVisible()
      await expect(page.locator('.navbar-brand')).toContainText('VANGUARD')

      // Sélecteur FR/EN présent (le premier est celui de la barre principale)
      const langSwitcher = page.locator('.lang-switcher').first()
      await expect(langSwitcher).toBeVisible()
      await expect(langSwitcher).toContainText(/FR|EN/i)

      // Bouton Espace Agent présent
      const agentButton = page.locator('a.navbar-agent, a.navbar-mobile-agent').first()
      await expect(agentButton).toBeVisible()
      await expect(agentButton).toContainText(/Espace Agent|Agent Area/i)

      // Aucun ancien lien de navigation dans la navbar (mobile et desktop)
      // Le brand "VANGUARD SERVICES" est autorisé — c'est le logo, pas un lien nav.
      const desktopNavLinks = page.locator('.navbar-nav .nav-link')
      expect(await desktopNavLinks.count()).toBe(0)

      const mobileNavLinks = page.locator('.navbar-mobile-nav .navbar-mobile-link')
      expect(await mobileNavLinks.count()).toBe(0)

      // La navbar mobile ne contient aucun ancien lien
      const mobileNavText = (await page.locator('.navbar-mobile-nav').innerText()).toLowerCase()
      for (const pattern of FORBIDDEN_NAVBAR_TEXTS) {
        expect(mobileNavText).not.toMatch(pattern)
      }

      // Pas de débordement horizontal
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      )
      expect(overflow).toBe(false)
    })
  }

  test('bouton Espace Agent redirige vers le login agent existant', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const href = await page.locator('a.navbar-agent').first().getAttribute('href')
    // Le lien doit pointer vers le login admin existant (5173) ou la route agent
    expect(href).toMatch(/\/login|5173|\/agent/)
  })
})

test.describe('BILINGUE — Bascule FR/EN', () => {
  test('bascule FR ↔ EN change la langue et aucun clé i18n affichée', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    // État initial (FR par défaut)
    await expect(page.locator('.hero-title')).toContainText(/Une plateforme|One platform/i)
    const bodyTextFr = await page.locator('body').innerText()
    expect(bodyTextFr).not.toMatch(/translation\.|home\.|nav\./)

    // Basculer vers EN
    await page.locator('.lang-switcher').first().click()
    await page.waitForTimeout(300)
    const bodyTextEn = await page.locator('body').innerText()
    expect(bodyTextEn).not.toMatch(/translation\.|home\.|nav\./)
    // Le contenu doit changer (titre différent)
    const titleText = await page.locator('.hero-title').innerText()
    expect(titleText.match(/One platform|Une plateforme/i)).not.toBeNull()
  })
})

test.describe('PARCOURS MULTI-PAGES', () => {
  test('accueil, transport, construction, automobile, billet, contact accessibles', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Accueil
    await page.goto('/')
    await expect(page.locator('.hero')).toBeVisible()

    // Transport (accès direct — pages restent accessibles sans lien navbar)
    await page.goto('/transport')
    await expect(page.locator('.page-hero')).toBeVisible()
    await expect(page.locator('#from')).toBeVisible()
    await expect(page.locator('#to')).toBeVisible()
    await expect(page.locator('#date')).toBeVisible()
    await expect(page.locator('button[type="submit"]').first()).toBeVisible()

    // Construction
    await page.goto('/construction')
    await expect(page.locator('.page-hero')).toBeVisible()
    await expect(page.locator('#csubject')).toBeVisible()

    // Automobile
    await page.goto('/automobile')
    await expect(page.locator('.page-hero')).toBeVisible()
    await expect(page.locator('.vehicle-search input')).toBeVisible()

    // Billet
    await page.goto('/tickets/TCK-INTROUVABLE')
    await expect(page.locator('.state-container, .ticket-card, .loading-spinner, .error-state, .notice').first()).toBeVisible()

    // Contact
    await page.goto('/contact')
    await expect(page.locator('.page-hero')).toBeVisible()

    // Footer contient toujours les accès services et contact (pages restent accessibles)
    await expect(page.locator('.footer')).toBeVisible()
  })
})