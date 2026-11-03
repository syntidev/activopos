import { test, expect, request as pwRequest, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import path from 'path'
import { envValue, sql } from './alta-helpers'

/**
 * Hotfix 2 del POS: fotos en la búsqueda y precio de las tarjetas según el modo del ticket (BCV / Divisa).
 * Negocio 80, servidor local, datos ZZ con limpieza en afterAll.
 *   A: Full 100 / Divisa 80, con foto.   B: Full 50 / sin Divisa, con foto.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 80
const ADMIN_ID = 79
const TAG = String(Date.now()).slice(-7)
const NAME_A = `ZZ PosDiv A ${TAG}`
const NAME_B = `ZZ PosDiv B ${TAG}`
const FOTO = '/apple-touch-icon.png'
const SHOTS = path.join(__dirname, '__capturas__')
const usd = (n: number) => `$${n.toFixed(2)}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let abriCaja = false

const token = async (): Promise<string> =>
  new SignJWT({ userId: ADMIN_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

function cleanup(): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ PosDiv%'`).split('\n').filter(Boolean).join(',')
  if (!ids) return
  const sales = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${ids})`).split('\n').filter(Boolean).join(',')
  if (sales) {
    sql(`DELETE FROM sale_payments WHERE sale_id IN (${sales})`)
    sql(`DELETE FROM sale_items WHERE sale_id IN (${sales})`)
    sql(`DELETE FROM sales WHERE business_id=${BUSINESS_ID} AND id IN (${sales})`)
  }
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
  sql(`DELETE FROM products WHERE business_id=${BUSINESS_ID} AND id IN (${ids})`)
}

test.beforeAll(async () => {
  cleanup()
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  if (Number(sql(`SELECT COUNT(*) FROM cash_registers WHERE business_id=${BUSINESS_ID} AND closed_at IS NULL`)) === 0) {
    const open = await api.post('/api/cash/open', { data: { opening_amount_usd: 0, opening_amount_bs: 0 } })
    expect(open.status(), await open.text()).toBe(201)
    abriCaja = true
  }
  const mk = async (name: string, price: number, divisa: number | null) => {
    const r = await api.post('/api/products', {
      data: { name, cost_per_unit_usd: 10, price_per_unit_usd: price, is_fixed_price: true, stock_quantity: 10, images: [FOTO], ...(divisa ? { wholesale_price_usd: divisa } : {}) },
    })
    expect(r.status(), await r.text()).toBe(201)
  }
  await mk(NAME_A, 100, 80)
  await mk(NAME_B, 50, null)
})

test.afterAll(async () => {
  cleanup()
  if (abriCaja) await api.post('/api/cash/close', { data: { closing_amount_usd: 0, closing_amount_bs: 0, close_notes: 'ZZ prueba pos-busqueda-divisa' } })
  await api.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ PosDiv%'`))).toBe(0)
})

async function abrirPOS(page: Page, vista: 'grid' | 'list'): Promise<void> {
  await page.context().addCookies([{ name: 'activopos_session', value: await token(), url: BASE }])
  await page.addInitScript(v => localStorage.setItem('pos_view', v), vista)
  await page.goto('/pos')
  await expect(page.getByPlaceholder('Buscar producto o código...')).toBeVisible()
}

const card = (page: Page, name: string): Locator => page.getByTestId('product-card').filter({ hasText: name }).first()
const radio = (page: Page, name: 'BCV (Bs)' | 'Divisa ($)') => page.getByRole('radio', { name })
const totalUsd = (page: Page) => page.locator('[class*="totalUsdValue"]')

/** La foto cargó de verdad: src no vacío y naturalWidth > 0 (no la letra de relleno). */
async function conFoto(c: Locator): Promise<void> {
  const img = c.locator('img')
  await expect(img).toHaveCount(1)
  await expect(img).toHaveAttribute('src', /\S+/)
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
}

async function buscar(page: Page): Promise<void> {
  await page.getByPlaceholder('Buscar producto o código...').fill(`ZZ PosDiv ${TAG}`)
  await expect(card(page, NAME_A)).toBeVisible()
  await expect(card(page, NAME_B)).toBeVisible()
}

for (const vista of ['grid', 'list'] as const) {
  test(`fotos (${vista}): el producto con imagen la muestra en la vista inicial y en la búsqueda`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await abrirPOS(page, vista)
    // Vista inicial (browse): el producto está en la lista de disponibles
    await expect(card(page, NAME_A)).toBeVisible()
    await conFoto(card(page, NAME_A))
    await conFoto(card(page, NAME_B))
    // Búsqueda: antes salía la letra de relleno porque el hook guardaba la respuesta cruda sin image_path
    await buscar(page)
    await conFoto(card(page, NAME_A))
    await conFoto(card(page, NAME_B))
    await expect(card(page, NAME_A).locator('[class*="placeholder"], [class*="thumbInitial"]')).toHaveCount(0)
  })
}

for (const donde of ['vista inicial', 'resultados de búsqueda'] as const) {
  test(`precio por modo (${donde}): la tarjeta, el aviso y la línea del ticket coinciden, y volver a BCV restaura`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await abrirPOS(page, 'grid')
    if (donde === 'resultados de búsqueda') await buscar(page)
    const a = card(page, NAME_A)
    const b = card(page, NAME_B)
    await expect(a).toBeVisible()

    // BCV: 100 y 50, USD y Bs a la vez, sin aviso
    await expect(radio(page, 'BCV (Bs)')).toHaveAttribute('aria-checked', 'true')
    await expect(a).toContainText(usd(100))
    await expect(a).toContainText('Bs.')
    await expect(b).toContainText(usd(50))
    await expect(page.getByTestId('product-card').filter({ hasText: 'Sin precio Divisa' })).toHaveCount(0)

    // Divisa: las tarjetas visibles cambian al instante (sin recargar): A = 80; B no tiene Divisa → Full con aviso
    await radio(page, 'Divisa ($)').click()
    await expect(a).toContainText(usd(80))
    await expect(a).not.toContainText(usd(100))
    await expect(a).toContainText('Bs.')
    await expect(a).not.toContainText('Sin precio Divisa')
    await expect(b).toContainText(usd(50))
    await expect(b).toContainText('Sin precio Divisa')
    if (donde === 'resultados de búsqueda') {
      await page.screenshot({ path: path.join(SHOTS, 'pos-busqueda-divisa-1440.png') })
      await page.setViewportSize({ width: 375, height: 812 })
      await page.screenshot({ path: path.join(SHOTS, 'pos-busqueda-divisa-375.png') })
      await page.setViewportSize({ width: 1440, height: 900 })
    }

    // Al agregar, la línea coincide con la tarjeta (80, luego 80 + 50)
    await a.click()
    await expect(totalUsd(page)).toHaveText(usd(80))
    await b.click()
    await expect(totalUsd(page)).toHaveText(usd(130))

    // Volver a BCV: tarjetas y ticket vuelven (100, 50 → 150)
    await radio(page, 'BCV (Bs)').click()
    await expect(a).toContainText(usd(100))
    await expect(b).toContainText(usd(50))
    await expect(b).not.toContainText('Sin precio Divisa')
    await expect(totalUsd(page)).toHaveText(usd(150))
  })
}

test('lista: la fila muestra el precio del modo y el aviso', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await abrirPOS(page, 'list')
  await buscar(page)
  await radio(page, 'Divisa ($)').click()
  await expect(card(page, NAME_A)).toContainText(usd(80))
  await expect(card(page, NAME_B)).toContainText('Sin precio Divisa')
  await radio(page, 'BCV (Bs)').click()
  await expect(card(page, NAME_A)).toContainText(usd(100))
})
