/**
 * Certificación Núcleo POS — Sprint 10
 * Flujo: Dashboard → POS búsqueda → Venta → Cobro → Confirmación → KPIs
 *
 * Corre en el tenant propio 267 "ZZ D Pruebas" con sesión propia (JWT firmado con JWT_SECRET), sin depender de
 * tests/.auth-state.json ni del tenant 1. Crea su producto y su caja, y al final borra sus ventas, su producto y su
 * caja (con movimientos y bitácora). Selectores por rol, texto y aria: ya no por clases con hash de CSS Modules.
 */
import { test, expect, type Page } from '@playwright/test'
import { BASE, BUSINESS_ID, apiAs, assertOwnTenant, cashSnapshot, login, purgeCashSince, type CashSnapshot } from './d-tenant'
import { closeOwnCashRegister, openOwnCashRegister } from './cash-helpers'
import { sql } from './alta-helpers'

const PRODUCT = 'ZZ PosCore Arepa'
const PRICE_USD = 3.5
const SEARCH_BUDGET_MS = 2000

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 90_000 })
test.beforeEach(async ({ page }) => { await login(page) })

let abriCaja = false
let cashBefore: CashSnapshot = { register: 0, log: 0, sale: 0 }

function cleanup(): void {
  const prods = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ PosCore%'`).split('\n').filter(Boolean)
  if (prods.length === 0) return
  const list = prods.join(',')
  const sales = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${list})`).split('\n').filter(Boolean)
  if (sales.length > 0) {
    const sl = sales.join(',')
    sql(`DELETE FROM activity_logs WHERE business_id=${BUSINESS_ID} AND model_type='Sale' AND model_id IN (${sl})`)
    sql(`DELETE FROM sale_payments WHERE sale_id IN (${sl})`)
    sql(`DELETE FROM sale_items WHERE sale_id IN (${sl})`)
    sql(`DELETE FROM sales WHERE business_id=${BUSINESS_ID} AND id IN (${sl})`)
  }
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${list})`)
  sql(`DELETE FROM product_variants WHERE product_id IN (${list})`)
  sql(`DELETE FROM product_collections WHERE product_id IN (${list})`)
  sql(`DELETE FROM products WHERE business_id=${BUSINESS_ID} AND id IN (${list})`)
}

test.beforeAll(async () => {
  assertOwnTenant()
  cleanup()
  cashBefore = cashSnapshot()
  const api = await apiAs()
  abriCaja = await openOwnCashRegister(api) // si el tenant ya tenía una abierta no es nuestra y no se toca
  const p = await api.post('/api/products', {
    data: { name: PRODUCT, cost_per_unit_usd: 1.5, price_per_unit_usd: PRICE_USD, is_fixed_price: true, stock_quantity: 50 },
  })
  expect(p.status(), await p.text()).toBe(201)
  // Calienta la ruta de búsqueda: en un servidor de desarrollo la primera llamada compila y rompería el presupuesto de T03.
  await api.get(`/api/products/search?q=${encodeURIComponent('zz poscore')}`)
  await api.dispose()
})

test.afterAll(async () => {
  if (abriCaja) {
    const api = await apiAs()
    await closeOwnCashRegister(api)
    await api.dispose()
  }
  cleanup()
  // Borradores DRF que el POS crea al abrirse, caja propia con sus movimientos y la bitácora de la ventana.
  purgeCashSince(cashBefore)
})

/** Tarjeta del producto en la cuadrícula del POS (el aria-label "Agregar … al ticket" es de la vista de lista). */
const addProductButton = (page: Page) => page.getByTestId('product-card').filter({ hasText: PRODUCT }).first()

/** Fila "TOTAL USD" del ticket: el rótulo y su valor comparten contenedor. */
const totalUsdRow = (page: Page) => page.getByText('TOTAL USD').locator('..')
const totalBsRow = (page: Page) => page.getByText(/^En Bs\./).locator('..')

test.describe('POS Core Flow — Certificación Sprint 10', () => {
  test('T01 — dashboard carga con KPIs visibles', async ({ page }) => {
    await page.goto('/escritorio')
    await expect(page).toHaveURL(/\/escritorio/)
    // KPI principal del escritorio: "Cobrado" (antes "Facturación total", que ya no existe)
    await expect(page.getByLabel('Cobrado', { exact: true })).toBeVisible({ timeout: 20_000 })
    // Tasa BCV en header
    await expect(page.getByText('USD/VES', { exact: false }).first()).toBeVisible({ timeout: 20_000 })
  })

  test('T02 — caja abierta visible en header', async ({ page }) => {
    await page.goto('/escritorio')
    // Hay dos: el de la barra lateral y la pastilla del header; cualquiera sirve.
    await expect(page.getByRole('button', { name: /Caja abierta/ }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Abierta hace/).first()).toBeVisible()
  })

  test(`T03 — búsqueda POS devuelve el producto en < ${SEARCH_BUDGET_MS / 1000}s`, async ({ page }) => {
    await page.goto('/pos')
    const searchInput = page.getByPlaceholder('Buscar producto o código...')
    await expect(searchInput).toBeVisible({ timeout: 20_000 })
    const t0 = Date.now()
    await searchInput.fill('zz poscore')
    await expect(addProductButton(page)).toBeVisible({ timeout: SEARCH_BUDGET_MS })
    expect(Date.now() - t0).toBeLessThan(SEARCH_BUDGET_MS)
  })

  test('T04 — agregar producto al ticket actualiza totales USD y Bs', async ({ page }) => {
    await page.goto('/pos')
    await page.getByPlaceholder('Buscar producto o código...').fill('zz poscore')
    await expect(addProductButton(page)).toBeEnabled({ timeout: 10_000 })
    await addProductButton(page).click()

    // Producto en ticket
    await expect(page.getByTestId('ticket-line').filter({ hasText: PRODUCT })).toHaveCount(1)
    // Total USD: $3.50
    await expect(totalUsdRow(page)).toContainText(PRICE_USD.toFixed(2))
    // Total Bs: no es cero
    await expect(totalBsRow(page)).not.toContainText(/Bs\.\s*0,00/)
  })

  test('T05 — venta completa: cobro Efectivo Bs → toast confirmación', async ({ page }) => {
    await page.goto('/pos')
    await page.getByPlaceholder('Buscar producto o código...').fill('zz poscore')
    await expect(addProductButton(page)).toBeEnabled({ timeout: 10_000 })
    await addProductButton(page).click()
    await expect(page.getByTestId('ticket-line').filter({ hasText: PRODUCT })).toHaveCount(1)

    // Procesar pago
    await page.getByRole('button', { name: 'Procesar Pago' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Procesar Pago' })
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Seleccionar "Efectivo Bs"
    await dialog.getByText('Efectivo Bs').click()

    // Input de monto visible con placeholder del total (value starts empty — uses placeholder as hint)
    const amountInput = dialog.getByLabel('Monto recibido', { exact: true })
    await expect(amountInput).toBeVisible()
    const placeholder = await amountInput.getAttribute('placeholder')
    expect(parseFloat(placeholder ?? '0')).toBeGreaterThan(0)

    // "Confirmar Venta" habilitado cuando hay método seleccionado
    await expect(dialog.getByRole('button', { name: 'Confirmar Venta' })).toBeEnabled()
    await dialog.getByRole('button', { name: 'Confirmar Venta' }).click()

    // Panel de éxito (antes un toast "Venta procesada exitosamente")
    await expect(page.getByText('¡Venta registrada!')).toBeVisible({ timeout: 10_000 })

    // La venta quedó pagada en la DB y es de este spec
    expect(sql(`SELECT s.status FROM sales s JOIN sale_items si ON si.sale_id=s.id JOIN products p ON p.id=si.product_id WHERE s.business_id=${BUSINESS_ID} AND p.name='${PRODUCT}' ORDER BY s.id DESC LIMIT 1`)).toBe('paid')
  })

  test('T06 — dashboard KPIs reflejan ventas del día > $0', async ({ page }) => {
    await page.goto('/escritorio')
    const kpi = page.getByLabel('Cobrado', { exact: true })
    await expect(kpi).toBeVisible({ timeout: 20_000 })
    // La venta de T05 (3.50 USD) ya está cobrada: el KPI la refleja.
    await expect(kpi).toContainText(/3[.,]50/)
  })
})
