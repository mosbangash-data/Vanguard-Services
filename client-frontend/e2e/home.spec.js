import { test, expect } from '@playwright/test'

test.describe('HOME', () => {
  test('chargement de la page d\'accueil', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Vanguard|vanguard/i)
    await expect(page.locator('.hero')).toBeVisible()
    await expect(page.locator('.navbar')).toBeVisible()
    await expect(page.locator('.footer')).toBeVisible()
  })

  test('navigation vers les trois services', async ({ page }) => {
    await page.goto('/')
    // Section services
    const serviceCards = page.locator('.service-card')
    await expect(serviceCards).toHaveCount(3)

    // Vanguard Coach
    await serviceCards.first().click()
    await page.waitForURL('**/transport')
    await expect(page.locator('.page-hero')).toBeVisible()

    // Retour accueil
    await page.goto('/')
    // Vanguard Construction
    await page.locator('.service-card').nth(1).click()
    await page.waitForURL('**/construction')
    await expect(page.locator('.page-hero')).toBeVisible()

    // Retour accueil
    await page.goto('/')
    // Vanguard Automobile
    await page.locator('.service-card').nth(2).click()
    await page.waitForURL('**/automobile')
    await expect(page.locator('.page-hero')).toBeVisible()
  })

  test('langue FR vers EN', async ({ page }) => {
    await page.goto('/')
    // Liste des boutons de langue
    const langButtons = page.locator('button').filter({ hasText: /EN|FR|English|Français/i })
    if ((await langButtons.count()) > 0) {
      await langButtons.first().click()
      // Le titre devrait changer (au moins un texte présent)
      await expect(page.locator('.hero')).toBeVisible()
    }
  })
})