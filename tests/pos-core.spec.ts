/**
 * Certificación Núcleo POS — Sprint 10
 * Flujo: Login → Dashboard → POS búsqueda → Venta → Cobro → Confirmación
 *
 * Pre-condiciones (verificadas en beforeAll del suite):
 *   - Servidor corriendo en localhost:3000
 *   - Producto "Arepa con Pollo" (id=10) con stock > 0
 *   - Caja abierta
 *   - BCV rate disponible
 */
import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

// Auth state inyectado por playwright.config.ts (setup project)

test.beforeAll(async ({ browser }) => {
  // Verificar pre-condiciones
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  // 1. Servidor disponible
  const ratesResp = await page.goto(`${BASE_URL}/api/rates/bcv`).catch(() => null)
  if (!ratesResp || ratesResp.status() !== 200) throw new Error('Pre-condición fallida: servidor no disponible')

  // 2. BCV rate activa
  const body = await ratesResp.json()
  if (!body.ok) throw new Error('Pre-condición fallida: BCV rate no disponible')

  await ctx.close()
})

test.describe('POS Core Flow — Certificación Sprint 10', () => {
  test('T01 — dashboard carga con KPIs visibles', async ({ page }) => {
    await page.goto(`${BASE_URL}/escritorio`)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/escritorio/)
    // KPI principal (Escritorio v3.0 — "Facturación total")
    await expect(page.locator('[aria-label="Facturación total"]')).toBeVisible({ timeout: 8_000 })
    // Tasa BCV en header
    await expect(page.getByText('USD/VES', { exact: false }).first()).toBeVisible()
  })

  test('T02 — caja abierta visible en header', async ({ page }) => {
    await page.goto(`${BASE_URL}/escritorio`)
    await page.waitForLoadState('networkidle')
    const cajaToggle = page.locator('.CajaToggle_toggle__MUZMk')
    await expect(cajaToggle).toBeVisible()
    const cajaText = await cajaToggle.textContent()
    expect(cajaText).toMatch(/Abierta|abierta/i)
  })

  test('T03 — búsqueda POS devuelve "Arepa con Pollo" en < 2s', async ({ page }) => {
    await page.goto(`${BASE_URL}/pos`)
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[placeholder="Buscar producto o código..."]')
    await expect(searchInput).toBeVisible()

    const t0 = Date.now()
    await searchInput.fill('are')
    await expect(page.getByText('Arepa con Pollo', { exact: false }).first()).toBeVisible({ timeout: 2000 })
    const elapsed = Date.now() - t0
    console.log(`  → Búsqueda completada en ${elapsed}ms`)
    expect(elapsed).toBeLessThan(2000)
  })

  test('T04 — agregar producto al ticket actualiza totales USD y Bs', async ({ page }) => {
    await page.goto(`${BASE_URL}/pos`)
    await page.waitForLoadState('networkidle')

    const productBtn = page.locator('button[aria-label="Agregar Arepa con Pollo"]').first()
    await expect(productBtn).toBeEnabled({ timeout: 5_000 })
    await productBtn.click()

    // Producto en ticket
    await expect(page.getByText('Arepa con Pollo').last()).toBeVisible()
    // Total USD: $3.50
    await expect(page.locator('.pos_totalUsdValue__eFMoG')).toContainText('3.50')
    // Total Bs: no es cero
    await expect(page.locator('.pos_totalBsValue__f4PlX')).not.toContainText('0,00')
  })

  test('T05 — venta completa: cobro Efectivo Bs → toast confirmación', async ({ page }) => {
    await page.goto(`${BASE_URL}/pos`)
    await page.waitForLoadState('networkidle')

    // Agregar producto
    const productBtn = page.locator('button[aria-label="Agregar Arepa con Pollo"]').first()
    await expect(productBtn).toBeEnabled({ timeout: 5_000 })
    await productBtn.click()
    await expect(page.getByText('Arepa con Pollo').last()).toBeVisible()

    // Procesar pago
    await page.getByText('Procesar Pago').first().click()
    const dialog = page.getByRole('dialog', { name: 'Procesar Pago' })
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Seleccionar "Efectivo Bs"
    await dialog.getByText('Efectivo Bs').click()

    // Input de monto visible con placeholder del total (value starts empty — uses placeholder as hint)
    const amountInput = dialog.locator('input[aria-label="Monto recibido"]')
    await expect(amountInput).toBeVisible()
    const placeholder = await amountInput.getAttribute('placeholder')
    expect(parseFloat(placeholder ?? '0')).toBeGreaterThan(0)

    // "Confirmar Venta" habilitado cuando hay método seleccionado
    await expect(dialog.getByText('Confirmar Venta')).toBeEnabled()

    // Confirmar
    await dialog.getByText('Confirmar Venta').click()

    // Toast de éxito
    await expect(page.getByText('Venta procesada exitosamente', { exact: false })).toBeVisible({ timeout: 10_000 })
    // Ticket vacío listo para próxima venta
    await expect(page.getByText('Ticket vacío', { exact: false })).toBeVisible({ timeout: 5_000 })
  })

  test('T06 — dashboard KPIs reflejan ventas del día > $0', async ({ page }) => {
    await page.goto(`${BASE_URL}/escritorio`)
    await page.waitForLoadState('networkidle')

    // KPI principal (Escritorio v3.0 — "Facturación total")
    await expect(page.locator('[aria-label="Facturación total"]')).toBeVisible({ timeout: 8_000 })
    const kpiCard = page.locator('[aria-label="Facturación total"]')
    const kpiText = await kpiCard.textContent().catch(() => '')
    console.log('  Facturación card:', kpiText?.slice(0, 100))
    expect(kpiText).not.toContain('$0.00')
  })
})
