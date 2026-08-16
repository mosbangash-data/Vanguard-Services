import { test, expect } from '@playwright/test'

test.describe('TRANSPORT', () => {
  test('page transport se charge avec formulaire de recherche', async ({ page }) => {
    await page.goto('/transport')
    await expect(page.locator('.page-hero')).toBeVisible()
    await expect(page.locator('#from')).toBeVisible()
    await expect(page.locator('#to')).toBeVisible()
    await expect(page.locator('#date')).toBeVisible()
    await expect(page.locator('button[type="submit"]').first()).toBeVisible()
  })

  test('recherche vide affiche un message', async ({ page }) => {
    await page.goto('/transport')
    await page.locator('#from').fill('VilleInexistanteXYZ')
    await page.locator('#to').fill('AutreVilleInexistante')
    await page.locator('#date').fill('2030-01-01')
    await page.locator('button[type="submit"]').first().click()
    // Attendre les résultats (soit un message de résultat vide, soit des trajets)
    await expect(page.locator('.booking-results, .notice').first()).toBeVisible({ timeout: 15000 })
  })

  test('bouton consulter ma réservation présent', async ({ page }) => {
    await page.goto('/transport')
    const lookup = page.locator('#lookupCode')
    await expect(lookup).toBeVisible()
    await expect(page.locator('button[type="submit"]').last()).toBeVisible()
  })
})

test.describe('TRANSPORT — Responsive mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('formulaire de recherche utilisable sur mobile', async ({ page }) => {
    await page.goto('/transport')
    await expect(page.locator('.page-hero')).toBeVisible()
    // Pas de débordement horizontal
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
    await expect(page.locator('#from')).toBeVisible()
  })
})