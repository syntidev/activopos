import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql, BUSINESS_ID, USER_ID } from './alta-helpers'

/**
 * Punto 2: la cabecera del POS ya no muestra un badge "Divisa" por el tipo de cliente (el modo lo dice el selector junto al total).
 * Punto 4: las líneas restauradas de un borrador se reprecian al instante al cambiar de modo (sin esperar al servidor).
 * Negocio 87, servidor local.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3002'
const TAG = String(Date.now()).slice(-8)
const NAME_A = `ZZ Borr A ${TAG}`
const NAME_B = `ZZ Borr B ${TAG}`
const CLIENT = `ZZ Cliente Mayor ${TAG}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

let idA = 0
let idB = 0
let clientId = 0
let draftId = 0

async function login(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: USER_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin OnBike' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

test.afterAll(() => {
  const ids = [idA, idB].filter(Boolean).join(',')
  if (ids) {
    const drafts = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${ids})`).split('\n').filter(Boolean).join(',')
    if (drafts) {
      sql(`DELETE FROM sale_items WHERE sale_id IN (${drafts})`)
      sql(`DELETE FROM sales WHERE id IN (${drafts}) AND business_id=${BUSINESS_ID} AND status='draft'`)
    }
  }
  for (const id of [idA, idB]) {
    if (!id) continue
    sql(`DELETE FROM inventory_entries WHERE product_id=${id}`)
    sql(`DELETE FROM products WHERE id=${id} AND business_id=${BUSINESS_ID}`)
  }
  if (clientId) sql(`DELETE FROM clients WHERE id=${clientId} AND business_id=${BUSINESS_ID}`)
})

test('cabecera del POS: un cliente de tipo Divisa ya no pinta badge; el modo sigue siendo BCV', async ({ page }) => {
  await login(page)
  const c = await page.request.post('/api/clients', { data: { name: CLIENT } })
  expect(c.status(), await c.text()).toBeLessThan(300)
  clientId = ((await c.json()) as { client: { id: number } }).client.id
  const p = await page.request.patch(`/api/clients/${clientId}`, { data: { price_tier: 'mayorista' } })
  expect(p.status(), await p.text()).toBeLessThan(300)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/pos')
  await page.getByRole('button', { name: 'Seleccionar cliente' }).click()
  await page.getByLabel('Buscar cliente').fill(CLIENT)
  await page.getByText(CLIENT, { exact: true }).first().click()

  const header = page.getByRole('button', { name: 'Seleccionar cliente' })
  await expect(header).toContainText(CLIENT)
  await expect(header).not.toContainText('Divisa')
  await expect(page.getByRole('radio', { name: 'BCV (Bs)' })).toHaveAttribute('aria-checked', 'true')
})

test('borrador restaurado: cambiar a Divisa reprecia al instante, aunque el servidor tarde', async ({ page }) => {
  await login(page)
  const mk = async (name: string, price: number, wholesale: number | null) => {
    const r = await page.request.post('/api/products', {
      data: { name, cost_per_unit_usd: 1, price_per_unit_usd: price, is_fixed_price: true, stock_quantity: 20, ...(wholesale ? { wholesale_price_usd: wholesale } : {}) },
    })
    expect(r.status()).toBe(201)
    return ((await r.json()) as { product: { id: number } }).product.id
  }
  idA = await mk(NAME_A, 10, 8)
  idB = await mk(NAME_B, 5, null)
  const d = await page.request.post('/api/pos/drafts', {
    data: { items: [{ product_id: idA, quantity: 1, discount_usd: 0 }, { product_id: idB, quantity: 1, discount_usd: 0 }] },
  })
  expect(d.status(), await d.text()).toBeLessThan(300)
  draftId = ((await d.json()) as { draft: { id: number } }).draft.id

  // El servidor tarda 8 s en responder el cambio de modo: el total debe cambiar antes, en el cliente.
  await page.route('**/api/sales/*/price-mode', async (route) => {
    await new Promise((r) => setTimeout(r, 8000))
    await route.continue()
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  // La hidratación pide por id exacto cada producto (+ sus tallas): se espera a que terminen, sin tiempos fijos.
  const hydrated = Promise.all([idA, idB].map((id) => page.waitForResponse((r) => r.url().endsWith(`/api/products/${id}/variants`))))
  await page.goto(`/pos?draft=${draftId}`)
  const total = page.locator('[class*="totalUsdValue"]')
  await expect(total).toHaveText('$15.00')
  await hydrated
  await page.waitForTimeout(300)

  await page.getByRole('radio', { name: 'Divisa ($)' }).click()
  await expect(total).toHaveText('$13.00', { timeout: 2000 })
  await expect(page.getByText('Sin precio Divisa', { exact: true }).first()).toBeVisible({ timeout: 2000 })
})

test('hidratación por id exacto: si el primer intento falla se reintenta y el repricing queda al instante', async ({ page }) => {
  await login(page)
  let byIdCalls = 0
  await page.route(`**/api/products/${idA}`, async (route) => {
    byIdCalls++
    if (byIdCalls === 1) { await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }); return }
    await route.continue()
  })
  await page.route('**/api/sales/*/price-mode', async (route) => {
    await new Promise((r) => setTimeout(r, 8000))
    await route.continue()
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/pos?draft=${draftId}`)
  const total = page.locator('[class*="totalUsdValue"]')
  await expect(total).toHaveText('$15.00')
  await expect.poll(() => byIdCalls, { timeout: 15_000 }).toBeGreaterThanOrEqual(2) // 1.º falló, el reintento llegó
  await page.waitForTimeout(1500)

  await page.getByRole('radio', { name: 'Divisa ($)' }).click()
  await expect(total).toHaveText('$13.00', { timeout: 2000 })
})
