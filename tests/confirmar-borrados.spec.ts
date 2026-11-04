import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Ninguna acción que borra datos ocurre sin un modal que informe y pida confirmar (POS).
 * Negocio 80, producto ZZ propio; los borradores que crea la prueba se borran al final.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BID = 80
const NAME = `ZZ ConfBorr ${String(Date.now()).slice(-6)}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let productId = 0

const token = async (): Promise<string> =>
  new SignJWT({ userId: 79, businessId: BID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

/** Borradores del negocio que contienen el producto ZZ (la fuente de verdad de "el borrador existe en la DB"). */
const borradoresConProducto = (): number =>
  Number(sql(`SELECT COUNT(DISTINCT s.id) FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE s.business_id=${BID} AND s.status='draft' AND si.product_id=${productId}`))

/** Borradores que creó esta prueba (pestañas "Nuevo"): ids posteriores al arranque, del admin 79. Evita llenar el tope de 5 pestañas. */
let baseSaleId = 0
function limpiarBorradores(): void {
  const drafts = sql(`SELECT id FROM sales WHERE business_id=${BID} AND status='draft' AND cashier_id=79 AND id>${baseSaleId}`).split('\n').filter(Boolean).join(',')
  if (!drafts) return
  sql(`DELETE FROM sale_items WHERE sale_id IN (${drafts})`)
  sql(`DELETE FROM sales WHERE business_id=${BID} AND status='draft' AND id IN (${drafts})`)
}

function cleanup(): void {
  limpiarBorradores()
  const ids = sql(`SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZ ConfBorr%'`).split('\n').filter(Boolean).join(',')
  if (!ids) return
  const drafts = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${ids})`).split('\n').filter(Boolean).join(',')
  if (drafts) {
    sql(`DELETE FROM sale_items WHERE sale_id IN (${drafts})`)
    sql(`DELETE FROM sales WHERE business_id=${BID} AND status='draft' AND id IN (${drafts})`)
  }
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND id IN (${ids})`)
}

test.beforeAll(async () => {
  baseSaleId = Number(sql('SELECT COALESCE(MAX(id),0) FROM sales'))
  cleanup()
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  const p = await api.post('/api/products', { data: { name: NAME, cost_per_unit_usd: 5, price_per_unit_usd: 20, is_fixed_price: true, stock_quantity: 50 } })
  expect(p.status(), await p.text()).toBe(201)
  productId = ((await p.json()) as { product: { id: number } }).product.id
})

test.beforeEach(() => { limpiarBorradores() })

test.afterAll(async () => {
  cleanup()
  await api?.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BID} AND name LIKE 'ZZ ConfBorr%'`))).toBe(0)
})

/** Abre /pos, crea un ticket nuevo y le agrega el producto ZZ; devuelve el rótulo de la pestaña activa. */
async function pestanaConProducto(page: Page): Promise<string> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.context().addCookies([{ name: 'activopos_session', value: await token(), url: BASE }])
  await page.goto('/pos')
  await page.getByRole('button', { name: 'Nuevo ticket' }).click()
  await expect(page.getByRole('tablist', { name: 'Tickets abiertos' }).getByRole('tab', { selected: true })).toBeVisible()
  await page.getByPlaceholder('Buscar producto o código...').fill(NAME)
  await page.getByTestId('product-card').filter({ hasText: NAME }).first().click()
  await expect(page.getByTestId('ticket-line')).toHaveCount(1)
  const label = ((await page.getByRole('tablist', { name: 'Tickets abiertos' }).getByRole('tab', { selected: true }).locator('span').first().textContent()) ?? '').trim()
  expect(label).not.toBe('')
  // el borrador del producto llega a la DB (se guarda al cambiar de pestaña)
  const tabs = page.getByRole('tablist', { name: 'Tickets abiertos' }).getByRole('tab')
  const antes = await tabs.count()
  await page.getByRole('button', { name: 'Nuevo ticket' }).click()
  await expect(tabs).toHaveCount(antes + 1) // la pestaña nueva ya existe (su creación es asíncrona)
  await expect(page.getByRole('tablist', { name: 'Tickets abiertos' }).getByRole('tab', { selected: true })).not.toContainText(label)
  await page.getByRole('tablist', { name: 'Tickets abiertos' }).getByRole('tab', { name: new RegExp(label) }).click()
  await expect(page.getByTestId('ticket-line')).toHaveCount(1)
  await expect.poll(borradoresConProducto, { timeout: 15_000 }).toBeGreaterThan(0)
  return label
}

test('X de una pestaña CON productos abre el modal, foco en Cancelar; Cancelar deja la pestaña y el borrador intactos', async ({ page }) => {
  const label = await pestanaConProducto(page)
  const antes = borradoresConProducto()
  await page.getByRole('button', { name: `Cerrar ${label}` }).click()

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(label)
  await expect(dialog).toContainText('1 producto')
  await expect(dialog).toContainText('$20,00')
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Cerrar y borrar ticket' })).toBeVisible()
  await page.screenshot({ path: 'tests/__capturas__/confirmar-cerrar-ticket-1280.png' })

  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('tablist', { name: 'Tickets abiertos' }).getByRole('tab', { name: new RegExp(label) })).toBeVisible()
  expect(borradoresConProducto()).toBe(antes)
})

test('Esc cancela: la pestaña y el borrador siguen', async ({ page }) => {
  const label = await pestanaConProducto(page)
  const antes = borradoresConProducto()
  await page.getByRole('button', { name: `Cerrar ${label}` }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(page.getByRole('tablist', { name: 'Tickets abiertos' }).getByRole('tab', { name: new RegExp(label) })).toBeVisible()
  expect(borradoresConProducto()).toBe(antes)
})

test('Confirmar borra la pestaña y el borrador de la DB', async ({ page }) => {
  const label = await pestanaConProducto(page)
  expect(borradoresConProducto()).toBeGreaterThan(0)
  await page.getByRole('button', { name: `Cerrar ${label}` }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cerrar y borrar ticket' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: `Cerrar ${label}` })).toHaveCount(0)
  await expect.poll(borradoresConProducto, { timeout: 15_000 }).toBe(0)
})

test('pestaña vacía se cierra directo, sin modal', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.context().addCookies([{ name: 'activopos_session', value: await token(), url: BASE }])
  await page.goto('/pos')
  const tabs = page.getByRole('tablist', { name: 'Tickets abiertos' }).getByRole('tab')
  await expect(tabs.first()).toBeVisible()
  const n = await tabs.count()
  await page.getByRole('button', { name: 'Nuevo ticket' }).click()
  await expect(tabs).toHaveCount(n + 1)
  const label = ((await page.getByRole('tablist', { name: 'Tickets abiertos' }).getByRole('tab', { selected: true }).locator('span').first().textContent()) ?? '').trim()
  await expect(page.getByTestId('ticket-line')).toHaveCount(0)
  await page.getByRole('button', { name: `Cerrar ${label}` }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(tabs).toHaveCount(n)
})

test('vaciar ticket pide confirmación: Cancelar conserva las líneas, confirmar las quita', async ({ page }) => {
  await pestanaConProducto(page)
  await page.getByRole('button', { name: 'Vaciar ticket' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('1 producto')
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByTestId('ticket-line')).toHaveCount(1)

  await page.getByRole('button', { name: 'Vaciar ticket' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Vaciar ticket' }).click()
  await expect(page.getByTestId('ticket-line')).toHaveCount(0)
})
