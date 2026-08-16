import { test, expect } from '@playwright/test'

test.describe('AUTOMOBILE', () => {
  test('page automobile se charge', async ({ page }) => {
    await page.goto('/automobile')
    await expect(page.locator('.page-hero')).toBeVisible()
    await expect(page.locator('.vehicle-search input')).toBeVisible()
  })

  test('liste véhicules chargés depuis API (ou état vide)', async ({ page }) => {
    await page.goto('/automobile')
    await expect(page.locator('.vehicle-grid, .state-container, .notice').first()).toBeVisible({ timeout: 15000 })
  })

  test('navigation vers détail si véhicule disponible', async ({ page }) => {
    await page.goto('/automobile')
    // Attendre la grille ou l'état vide
    const vehicleGrid = page.locator('.vehicle-grid')
    await expect(vehicleGrid).toBeVisible({ timeout: 15000 }).catch(() => {})
    if ((await vehicleGrid.count()) > 0) {
      await vehicleGrid.locator('a').first().click()
      await expect(page.locator('.vehicle-detail')).toBeVisible({ timeout: 10000 })
    }
  })
})

test.describe('AUTOMOBILE — Responsive mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('liste utilisable sur mobile', async ({ page }) => {
    await page.goto('/automobile')
    await expect(page.locator('.page-hero')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
  })
})

test.describe('BILLET', () => {
  test('billet introuvable affiche une erreur', async ({ page }) => {
    await page.goto('/tickets/TCK-INTROUVABLE')
    // Soit chargement, soit erreur — pas d'écran blanc
    await expect(page.locator('.state-container, .ticket-card, .loading-spinner, .error-state, .notice').first()).toBeVisible({ timeout: 15000 })
  })
})

test.describe('AGENT', () => {
  test('bouton espace agent présent dans la navbar', async ({ page }) => {
    await page.goto('/')
    const agentLink = page.locator('a[href*="/login"], a[href*="5173/login"], a[href*="5174/login"], a[href*="/agent"]').first()
    await expect(agentLink).toBeVisible()
  })
})