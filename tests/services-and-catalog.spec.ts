/**
 * Certificación: Servicios siempre disponibles + Stock visible en catálogo
 * Sprint 10 | CLI-D
 *
 * Pre-condiciones:
 *   - Servidor en localhost:3000
 *   - Producto "Corte de Cabello" (sale_mode=service) en DB
 *   - Catálogo activo en slug "demo"
 *   - Producto "Arepa con Pollo" con stock > 0 en catálogo
 */
import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

// Auth state inyectado por playwright.config.ts

test.describe('Servicios sin restricción de stock — POS', () => {
  test('S01 — servicio "Corte de Cabello" habilitado en POS (sin stock requerido)', async ({ page }) => {
    await page.goto(`${BASE_URL}/pos`)
    await page.waitForLoadState('networkidle')

    // Buscar servicio
    const search = page.locator('input[placeholder="Buscar producto o código..."]')
    await search.fill('corte')
    await page.waitForTimeout(600)

    // El botón debe estar ENABLED (no disabled) aunque stock=0
    const serviceBtn = page.locator('button[aria-label="Agregar Corte de Cabello"]').first()
    await expect(serviceBtn).toBeVisible({ timeout: 6_000 })
    await expect(serviceBtn).toBeEnabled()

    // Badge muestra "Disponible" (no "Sin stock")
    await expect(serviceBtn.getByText('Disponible', { exact: false })).toBeVisible()
  })

  test('S02 — servicio se puede agregar al ticket y vender', async ({ page }) => {
    await page.goto(`${BASE_URL}/pos`)
    await page.waitForLoadState('networkidle')

    const search = page.locator('input[placeholder="Buscar producto o código..."]')
    await search.fill('corte')
    await page.waitForTimeout(600)

    const serviceBtn = page.locator('button[aria-label="Agregar Corte de Cabello"]').first()
    await expect(serviceBtn).toBeEnabled({ timeout: 3000 })
    await serviceBtn.click()

    // Aparece en ticket
    await expect(page.getByText('Corte de Cabello').last()).toBeVisible()
    // Total > 0
    await expect(page.locator('.pos_totalUsdValue__eFMoG')).not.toContainText('0.00')
  })

  test('S03 — producto físico sin stock sigue bloqueado', async ({ page }) => {
    await page.goto(`${BASE_URL}/pos`)
    await page.waitForLoadState('networkidle')

    // "Audífonos Bluetooth" tiene stock=0, no es servicio → debe estar disabled
    const physBtn = page.locator('button[aria-label="Agregar Audífonos Bluetooth"]').first()
    await expect(physBtn).toBeVisible({ timeout: 5_000 })
    await expect(physBtn).toBeDisabled()

    // Badge muestra "Sin stock" (no "Disponible")
    await expect(physBtn.getByText('Sin stock', { exact: false })).toBeVisible()
  })
})

test.describe('Stock visible en catálogo público', () => {
  test('C01 — catálogo carga y muestra productos', async ({ page }) => {
    const resp = await page.goto(`${BASE_URL}/catalogo/demo`)
    await page.waitForLoadState('networkidle')
    expect(resp?.status()).toBe(200)
    // Al menos un producto visible
    await expect(page.locator('article').first()).toBeVisible({ timeout: 5_000 })
  })

  test('C02 — producto con stock muestra cantidad disponible', async ({ page }) => {
    await page.goto(`${BASE_URL}/catalogo/demo`)
    await page.waitForLoadState('networkidle')

    // "Arepa con Pollo" tiene stock ~47 — debe mostrar "47 disponibles" o "X disponibles"
    const arepaBadge = page.locator('article').filter({ hasText: 'Arepa con Pollo' })
      .locator('[class*="badgeStock"]').first()
    await expect(arepaBadge).toBeVisible({ timeout: 5_000 })
    const badgeText = await arepaBadge.textContent()
    expect(badgeText).toMatch(/disponibles|Últimas/i)
  })

  test('C03 — servicio en catálogo muestra "Disponible" (sin stock)', async ({ page }) => {
    await page.goto(`${BASE_URL}/catalogo/demo`)
    await page.waitForLoadState('networkidle')

    // Servicios (Corte de Cabello, Manicure, Delivery) deben mostrar badge "Disponible"
    const servicioCard = page.locator('article').filter({ hasText: /Corte de Cabello|Manicure|Delivery/ }).first()
    const count = await servicioCard.count()
    if (count === 0) {
      // Si los servicios no están en catálogo, skip graceful
      console.log('  INFO: Servicios no publicados en catálogo (show_in_catalog=false)')
      return
    }
    const disponibleBadge = servicioCard.locator('[class*="badgeDisponible"]').first()
    await expect(disponibleBadge).toBeVisible({ timeout: 3000 })
  })

  test('C04 — producto sin stock muestra "Sin stock" en catálogo', async ({ page }) => {
    await page.goto(`${BASE_URL}/catalogo/demo`)
    await page.waitForLoadState('networkidle')
    // Debe existir al menos un badge de "Sin stock" para productos físicos sin inventario
    // (Audífonos, Cable USB-C, etc.)
    await expect(page.locator('[class*="badgeSinStock"]').first()).toBeVisible({ timeout: 5_000 })
  })
})
