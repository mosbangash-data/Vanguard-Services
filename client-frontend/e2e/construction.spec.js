import { test, expect } from '@playwright/test'

test.describe('CONSTRUCTION', () => {
  test('page construction se charge', async ({ page }) => {
    await page.goto('/construction')
    await expect(page.locator('.page-hero')).toBeVisible()
    await expect(page.locator('.page-hero-title')).toContainText(/Construisons|build together/i)
  })

  test('formulaire demande client présent', async ({ page }) => {
    await page.goto('/construction')
    const subject = page.locator('#csubject')
    const name = page.locator('#cname')
    const phone = page.locator('#cphone')
    const message = page.locator('#cmessage')
    await expect(subject).toBeVisible()
    await expect(name).toBeVisible()
    await expect(phone).toBeVisible()
    await expect(message).toBeVisible()
  })

  test('formulaire demande de devis présent', async ({ page }) => {
    await page.goto('/construction')
    const qname = page.locator('#qname')
    const qphone = page.locator('#qphone')
    const qdesc = page.locator('#qdesc')
    await expect(qname).toBeVisible()
    await expect(qphone).toBeVisible()
    await expect(qdesc).toBeVisible()
  })

  test('réalisations chargées depuis API (ou état vide)', async ({ page }) => {
    await page.goto('/construction')
    // Attend la section projets
    await expect(page.locator('.project-grid, .state-container, .notice').first()).toBeVisible({ timeout: 15000 })
  })
})

test.describe('CONSTRUCTION — Responsive mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('formulaires utilisables sur mobile', async ({ page }) => {
    await page.goto('/construction')
    await expect(page.locator('.page-hero')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
    await expect(page.locator('#cname')).toBeVisible()
  })
})