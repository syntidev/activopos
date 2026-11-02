import { test, expect, request as pwRequest, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Hotfix 3 del POS: +, − y eliminar de cada línea del ticket (producto + talla). Negocio 80, servidor local, datos ZZ con limpieza.
 *   P (Full 100) con tallas T1 (100) y T2 (Full propio 120) · Q sin talla (30).
 * Flujo: agregar T1, T2 y Q → ajustar y eliminar por línea → recargar (borrador restaurado) y repetir → cobrar → verificar sale_items.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 80
const ADMIN_ID = 79
const TAG = String(Date.now()).slice(-7)
const NAME_P = `ZZ PosLin P ${TAG}`
const NAME_Q = `ZZ PosLin Q ${TAG}`
const usd = (n: number) => `$${n.toFixed(2)}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

let api: APIRequestContext
let abriCaja = false
let productP = 0
let productQ = 0
const talla: Record<string, number> = {}
let metodoPago = ''

const token = async (): Promise<string> =>
  new SignJWT({ userId: ADMIN_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

function cleanup(): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ PosLin%'`).split('\n').filter(Boolean).join(',')
  if (!ids) return
  const sales = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${ids})`).split('\n').filter(Boolean).join(',')
  if (sales) {
    sql(`DELETE FROM sale_payments WHERE sale_id IN (${sales})`)
    sql(`DELETE FROM sale_items WHERE sale_id IN (${sales})`)
    sql(`DELETE FROM sales WHERE business_id=${BUSINESS_ID} AND id IN (${sales})`)
  }
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_variants WHERE product_id IN (${ids})`)
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
  const methods = (await (await api.get('/api/payment-methods')).json()) as { methods?: Array<{ name: string }>; payment_methods?: Array<{ name: string }> }
  metodoPago = (methods.methods ?? methods.payment_methods ?? [])[0]?.name ?? ''
  expect(metodoPago, 'el negocio 80 necesita un método de pago').not.toBe('')

  const p = await api.post('/api/products', {
    data: {
      name: NAME_P, cost_per_unit_usd: 10, price_per_unit_usd: 100, is_fixed_price: true, stock_quantity: 0, has_variants: true,
      variants: ['T1', 'T2'].map(valor => ({ tipo: 'talla', valor, stock: 10 })),
    },
  })
  expect(p.status(), await p.text()).toBe(201)
  const created = (await p.json()) as { product: { id: number; variants: Array<{ id: number; valor: string }> } }
  productP = created.product.id
  for (const v of created.product.variants) talla[v.valor] = v.id
  const patch = await api.patch(`/api/products/${productP}/variants/${talla.T2}`, { data: { price_usd: 120 } })
  expect(patch.status(), await patch.text()).toBe(200)

  const q = await api.post('/api/products', { data: { name: NAME_Q, cost_per_unit_usd: 5, price_per_unit_usd: 30, is_fixed_price: true, stock_quantity: 10 } })
  expect(q.status(), await q.text()).toBe(201)
  productQ = ((await q.json()) as { product: { id: number } }).product.id
})

test.afterAll(async () => {
  cleanup()
  if (abriCaja) await api.post('/api/cash/close', { data: { closing_amount_usd: 0, closing_amount_bs: 0, close_notes: 'ZZ prueba pos-lineas' } })
  await api.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ PosLin%'`))).toBe(0)
})

const totalUsd = (page: Page) => page.locator('[class*="totalUsdValue"]')
const lineas = (page: Page) => page.getByTestId('ticket-line')
const mas = (l: Locator) => l.getByRole('button', { name: 'Aumentar cantidad' })
const menos = (l: Locator) => l.getByRole('button', { name: 'Reducir cantidad' })
const cantidad = (l: Locator) => l.locator('[class*="qtyValue"]')

async function buscar(page: Page): Promise<void> {
  await page.getByPlaceholder('Buscar producto o código...').fill(`ZZ PosLin `)
  await expect(page.getByTestId('product-card').filter({ hasText: NAME_P }).first()).toBeVisible()
}

async function agregarTalla(page: Page, valor: string): Promise<void> {
  await page.getByTestId('product-card').filter({ hasText: NAME_P }).first().click()
  await page.getByRole('dialog', { name: /Seleccionar variante/ }).getByRole('button', { name: new RegExp(`^${valor}`) }).click()
}

test('ticket: +, − y eliminar afectan solo la línea indicada, con totales correctos en cada paso', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.context().addCookies([{ name: 'activopos_session', value: await token(), url: BASE }])
  await page.goto('/pos')
  await buscar(page)

  await agregarTalla(page, 'T1')
  await agregarTalla(page, 'T2')
  await page.getByTestId('product-card').filter({ hasText: NAME_Q }).first().click()
  await expect(lineas(page)).toHaveCount(3)
  await expect(totalUsd(page)).toHaveText(usd(100 + 120 + 30))
  const [t1, t2] = [lineas(page).nth(0), lineas(page).nth(1)]

  // + en la línea de T1: solo T1 sube
  await mas(t1).click()
  await expect(cantidad(t1)).toContainText('2')
  await expect(cantidad(t2)).toContainText('1')
  await expect(totalUsd(page)).toHaveText(usd(200 + 120 + 30))
  // − en T1 vuelve a 1
  await menos(t1).click()
  await expect(cantidad(t1)).toContainText('1')
  await expect(totalUsd(page)).toHaveText(usd(100 + 120 + 30))

  // + dos veces en T2: solo T2
  await mas(t2).click()
  await mas(t2).click()
  await expect(cantidad(t2)).toContainText('3')
  await expect(cantidad(t1)).toContainText('1')
  await expect(totalUsd(page)).toHaveText(usd(100 + 360 + 30))

  // eliminar T1: quedan T2 (3) y Q (1)
  await t1.getByRole('button', { name: /^Eliminar/ }).click()
  await expect(lineas(page)).toHaveCount(2)
  await expect(totalUsd(page)).toHaveText(usd(360 + 30))
  await expect(cantidad(lineas(page).nth(0))).toContainText('3')
  await expect(cantidad(lineas(page).nth(1))).toContainText('1')
})

test('borrador restaurado: ajustar y eliminar sobre las líneas restauradas, y cobrar con las cantidades finales', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.context().addCookies([{ name: 'activopos_session', value: await token(), url: BASE }])
  // Borrador guardado en la DB (el POS lo restaura con /pos?draft=<id>): T1 ×2, T2 ×3 y Q ×1 (sin talla: variant_id null en la DB)
  const draft = await api.post('/api/pos/drafts', {
    data: { price_mode: 'bcv', items: [
      { product_id: productP, variant_id: talla.T1, quantity: 2, discount_usd: 0 },
      { product_id: productP, variant_id: talla.T2, quantity: 3, discount_usd: 0 },
      { product_id: productQ, quantity: 1, discount_usd: 0 },
    ] },
  })
  expect(draft.status(), await draft.text()).toBeLessThan(300)
  const draftId = ((await draft.json()) as { draft: { id: number } }).draft.id
  await page.goto(`/pos?draft=${draftId}`)
  await expect(lineas(page)).toHaveCount(3, { timeout: 30_000 })
  await expect(totalUsd(page)).toHaveText(usd(200 + 360 + 30))

  // eliminar la línea restaurada de T1 (con talla): solo desaparece esa
  await lineas(page).nth(0).getByRole('button', { name: /^Eliminar/ }).click()
  await expect(lineas(page)).toHaveCount(2)
  await expect(totalUsd(page)).toHaveText(usd(360 + 30))
  const [t2, q] = [lineas(page).nth(0), lineas(page).nth(1)]

  // − en la línea restaurada de T2 (con talla): 3 → 2
  await menos(t2).click()
  await expect(cantidad(t2)).toContainText('2')
  await expect(cantidad(q)).toContainText('1')
  await expect(totalUsd(page)).toHaveText(usd(240 + 30))
  // + en la línea restaurada sin talla (Q): 1 → 2
  await mas(q).click()
  await expect(cantidad(q)).toContainText('2')
  await expect(totalUsd(page)).toHaveText(usd(240 + 60))

  // eliminar la restaurada sin talla y volver a agregarla dos veces: la eliminación sí funcionó y la nueva línea suma en una sola
  await q.getByRole('button', { name: /^Eliminar/ }).click()
  await expect(lineas(page)).toHaveCount(1)
  await expect(totalUsd(page)).toHaveText(usd(240))
  await page.getByPlaceholder('Buscar producto o código...').fill('ZZ PosLin ')
  await page.getByTestId('product-card').filter({ hasText: NAME_Q }).first().click()
  await page.getByTestId('product-card').filter({ hasText: NAME_Q }).first().click()
  await expect(lineas(page)).toHaveCount(2)
  await expect(totalUsd(page)).toHaveText(usd(240 + 60))

  // cobrar: sale_items debe tener las cantidades finales por talla
  await page.getByText('Procesar Pago').first().click()
  const dialog = page.getByRole('dialog', { name: 'Procesar Pago' })
  await expect(dialog).toBeVisible()
  await dialog.getByText(metodoPago, { exact: true }).first().click()
  await dialog.getByText('Confirmar Venta').click()
  await expect(page.getByText('¡Venta registrada!')).toBeVisible({ timeout: 20_000 })

  const venta = sql(`SELECT s.id FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE s.business_id=${BUSINESS_ID} AND s.status='paid' AND si.product_id IN (${productP},${productQ}) ORDER BY s.id DESC LIMIT 1`)
  expect(venta, 'debe existir la venta pagada').not.toBe('')
  const items = sql(`SELECT product_id, IFNULL(variant_id,0), quantity, price_per_unit_usd FROM sale_items WHERE sale_id=${venta} ORDER BY product_id, variant_id`)
  expect(items.split('\n').map(r => r.split('\t').map(Number))).toEqual([
    [productP, talla.T2, 2, 120],
    [productQ, 0, 2, 30],
  ])
  // la talla eliminada (T1) no quedó en la venta y su stock no se movió
  expect(Number(sql(`SELECT COUNT(*) FROM sale_items WHERE sale_id=${venta} AND variant_id=${talla.T1}`))).toBe(0)
  expect(sql(`SELECT stock FROM product_variants WHERE id=${talla.T1}`)).toBe('10')
  expect(sql(`SELECT stock FROM product_variants WHERE id=${talla.T2}`)).toBe('8')
})
