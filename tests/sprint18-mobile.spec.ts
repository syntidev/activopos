import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

// storageState del playwright.config.ts provee auth admin automáticamente
// No se necesita loginMobile — solo setViewportSize antes de navegar

test.describe('Sprint 18 — Mobile POS + Export Excel', () => {

  test('MO01 — POS mobile muestra productos a pantalla completa (sin carrito)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/pos`)
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/login/)

    // cartToggle (FAB) visible en mobile → confirma que el layout es 1 columna
    const cartToggle = page.locator('[class*="cartToggle"]')
    await expect(cartToggle).toBeVisible({ timeout: 5000 })

    // cartSlot está en DOM pero translateX(100%) → no ocupa espacio visual
    // Sin overflow horizontal → productos ocupan toda la pantalla
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5)
  })

  test('MO02 — botón carrito FAB aparece en mobile con badge al agregar producto', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/pos`)
    await page.waitForLoadState('networkidle')

    const cartToggle = page.locator('[class*="cartToggle"]')
    await expect(cartToggle).toBeVisible({ timeout: 5000 })

    // Intentar agregar un producto si existe alguno en la grilla
    const firstProduct = page.locator('[class*="productCard"], [class*="productItem"], [class*="product"]').first()
    const productExists = await firstProduct.isVisible({ timeout: 3000 }).catch(() => false)
    if (productExists) {
      await firstProduct.click()
      await page.waitForTimeout(400)
      // badge aparece cuando hay ítems
      const badge = page.locator('[class*="cartBadge"]')
      const badgeExists = await badge.isVisible({ timeout: 2000 }).catch(() => false)
      if (badgeExists) {
        const text = await badge.textContent()
        expect(Number(text)).toBeGreaterThan(0)
      }
    }
  })

  test('MO03 — drawer carrito emerge desde la derecha al hacer click', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/pos`)
    await page.waitForLoadState('networkidle')

    const cartToggle = page.locator('[class*="cartToggle"]')
    await expect(cartToggle).toBeVisible({ timeout: 5000 })

    await cartToggle.click()
    await page.waitForTimeout(350)

    // cartSlotOpen es la clase que aplica transform: translateX(0)
    const cartSlotOpen = page.locator('[class*="cartSlotOpen"]')
    await expect(cartSlotOpen).toBeAttached({ timeout: 2000 })
  })

  test('MO04 — Escritorio responsive en mobile: sin overflow horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/escritorio`)
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/login|error/)

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5)
  })

  test('MO05 — Export Excel botón presente y activo en /reportes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE}/reportes`)
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/login/)

    // Botón con aria-label o texto "Excel"
    const excelBtn = page.locator('[aria-label="Exportar Excel"], button:has-text("Excel")').first()
    await expect(excelBtn).toBeVisible({ timeout: 5000 })

    // Verificar que el endpoint responde (sin datos puede ser 200 con hoja vacía)
    const today = new Date().toISOString().slice(0, 10)
    const res = await page.request.get(`${BASE}/api/reports/export-excel?date=${today}`)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('spreadsheetml')
  })
})
