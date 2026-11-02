import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import path from 'path'
import { envValue, sql } from './alta-helpers'

/**
 * Precio de tallas en modo BCV / Divisa (hotfix variantes-divisa). Negocio 80, servidor local, datos ZZ con limpieza en afterAll.
 * Producto Full 492 / Divisa 400 con 3 tallas: T1 sin precio propio · T2 Full propio 450 sin Divisa · T3 Full 450 y Divisa 380.
 * Esperado — BCV: 492 · 450 · 450.   Divisa: 400 · 450 (fallback marcado) · 380.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 80
const ADMIN_ID = 79
const TAG = String(Date.now()).slice(-7)
const NAME = `ZZ VarDiv ${TAG}`
const SHOTS = path.join(__dirname, '__capturas__')
const TALLAS = ['T1', 'T2', 'T3'] as const
const ESPERADO = {
  bcv:    { T1: 492, T2: 450, T3: 450 },
  divisa: { T1: 400, T2: 450, T3: 380 },
} as const
const usd = (n: number) => `$${n.toFixed(2)}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let productId = 0
const variantId: Record<string, number> = {}
const CASH_ID = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BUSINESS_ID} AND is_active=1 AND is_financing=0 ORDER BY id LIMIT 1`))

const token = async (): Promise<string> =>
  new SignJWT({ userId: ADMIN_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

function cleanup(): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ VarDiv%'`).split('\n').filter(Boolean).join(',')
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

let abriCaja = false

test.beforeAll(async () => {
  cleanup()
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  // El POS y el cobro exigen caja abierta: si el negocio 80 la tiene cerrada se abre para la prueba y se cierra al final.
  if (Number(sql(`SELECT COUNT(*) FROM cash_registers WHERE business_id=${BUSINESS_ID} AND closed_at IS NULL`)) === 0) {
    const open = await api.post('/api/cash/open', { data: { opening_amount_usd: 0, opening_amount_bs: 0 } })
    expect(open.status(), await open.text()).toBe(201)
    abriCaja = true
  }
  const r = await api.post('/api/products', {
    data: {
      name: NAME, cost_per_unit_usd: 100, price_per_unit_usd: 492, is_fixed_price: true, wholesale_price_usd: 400, stock_quantity: 0, has_variants: true,
      variants: TALLAS.map(valor => ({ tipo: 'talla', valor, stock: 5 })),
    },
  })
  expect(r.status(), await r.text()).toBe(201)
  const created = (await r.json()) as { product: { id: number; variants: Array<{ id: number; valor: string }> } }
  productId = created.product.id
  for (const v of created.product.variants) variantId[v.valor] = v.id
  const patch = async (t: string, data: Record<string, number>) => {
    const p = await api.patch(`/api/products/${productId}/variants/${variantId[t]}`, { data })
    expect(p.status(), await p.text()).toBe(200)
  }
  await patch('T2', { price_usd: 450 })
  await patch('T3', { price_usd: 450, divisa_price_usd: 380 })
})

test.afterAll(async () => {
  cleanup()
  if (abriCaja) await api.post('/api/cash/close', { data: { closing_amount_usd: 0, closing_amount_bs: 0, close_notes: 'ZZ prueba variantes-divisa' } })
  await api.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ VarDiv%'`))).toBe(0)
})

async function abrirPOS(page: Page): Promise<void> {
  await page.context().addCookies([{ name: 'activopos_session', value: await token(), url: BASE }])
  await page.goto('/pos')
  await page.getByPlaceholder('Buscar producto o código...').fill(NAME)
}

const selector = (page: Page) => page.getByRole('dialog', { name: /Seleccionar variante/ })
const radio = (page: Page, name: 'BCV (Bs)' | 'Divisa ($)') => page.getByRole('radio', { name })
const totalUsd = (page: Page) => page.locator('[class*="totalUsdValue"]')

async function abrirSelector(page: Page): Promise<void> {
  await page.getByText(NAME, { exact: true }).first().click()
  await expect(selector(page)).toBeVisible()
}

/** Precio que muestra el selector para cada talla (texto del botón de la talla). */
async function preciosSelector(page: Page): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const t of TALLAS) out[t] = (await selector(page).getByRole('button', { name: new RegExp(`^${t}`) }).getByTestId('variant-price').textContent()) ?? ''
  return out
}

test('POS: el selector y la línea del ticket muestran el precio del modo, y cambiar de modo reprecia', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await abrirPOS(page)
  await expect(radio(page, 'BCV (Bs)')).toHaveAttribute('aria-checked', 'true')

  // BCV: 492 · 450 · 450, sin aviso de Divisa; se agregan las tres tallas
  await abrirSelector(page)
  const bcv = await preciosSelector(page)
  for (const t of TALLAS) expect(bcv[t], `selector BCV ${t}`).toBe(usd(ESPERADO.bcv[t]))
  await expect(selector(page).getByText('Sin precio Divisa')).toHaveCount(0)
  await selector(page).getByRole('button', { name: /^T1/ }).click()
  for (const t of ['T2', 'T3'] as const) {
    await abrirSelector(page)
    await selector(page).getByRole('button', { name: new RegExp(`^${t}`) }).click()
  }
  await expect(totalUsd(page)).toHaveText(usd(ESPERADO.bcv.T1 + ESPERADO.bcv.T2 + ESPERADO.bcv.T3))

  // Cambio de modo con el ticket abierto: reprecia al instante a 400 · 450 (fallback) · 380
  await radio(page, 'Divisa ($)').click()
  await expect(radio(page, 'Divisa ($)')).toHaveAttribute('aria-checked', 'true')
  await expect(totalUsd(page)).toHaveText(usd(ESPERADO.divisa.T1 + ESPERADO.divisa.T2 + ESPERADO.divisa.T3))
  await expect(page.getByText('1 línea sin precio Divisa usa el BCV')).toBeVisible() // el aviso que ya existía, para T2

  // El selector en modo Divisa muestra lo mismo que cobra la línea: 400 · 450 (marcado) · 380, USD y Bs a la vez
  await abrirSelector(page)
  const divisa = await preciosSelector(page)
  for (const t of TALLAS) expect(divisa[t], `selector Divisa ${t}`).toBe(usd(ESPERADO.divisa[t]))
  await expect(selector(page).getByRole('button', { name: /^T2/ }).getByText('Sin precio Divisa')).toBeVisible()
  await expect(selector(page).getByRole('button', { name: /^T1/ }).getByText('Sin precio Divisa')).toHaveCount(0)
  await expect(selector(page).getByRole('button', { name: /^T3/ })).toContainText('Bs.')
  await page.screenshot({ path: path.join(SHOTS, 'variantes-divisa-selector-1280.png') })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.screenshot({ path: path.join(SHOTS, 'variantes-divisa-selector-375.png') })

  // Volver a BCV reprecia a 492 · 450 · 450
  await page.setViewportSize({ width: 1440, height: 900 })
  await selector(page).getByRole('button', { name: 'Cerrar' }).click()
  await radio(page, 'BCV (Bs)').click()
  await expect(totalUsd(page)).toHaveText(usd(ESPERADO.bcv.T1 + ESPERADO.bcv.T2 + ESPERADO.bcv.T3))
})

for (const mode of ['bcv', 'divisa'] as const) {
  test(`cobro en modo ${mode}: sale_items.price_per_unit_usd == precio del selector y de la línea`, async () => {
    const venta = await api.post('/api/sales', {
      data: {
        status: 'pending', origin: 'pos', price_mode: mode,
        items: TALLAS.map(t => ({ product_id: productId, variant_id: variantId[t], quantity: 1, sale_mode: 'unit' })),
      },
    })
    expect(venta.status(), await venta.text()).toBe(201)
    const sale = (await venta.json()).sale as { id: number; total_usd: number | string; total_bs: number | string }
    const pay = await api.patch(`/api/sales/${sale.id}/pay`, {
      data: { payments: [{ payment_method_id: CASH_ID, amount_bs: Number(sale.total_bs), amount_usd: Number(sale.total_usd) }] },
    })
    expect(pay.status(), await pay.text()).toBe(200)
    for (const t of TALLAS) {
      const price = Number(sql(`SELECT price_per_unit_usd FROM sale_items WHERE sale_id=${sale.id} AND variant_id=${variantId[t]}`))
      expect(price, `${mode} ${t}`).toBe(ESPERADO[mode][t])
    }
    const fuentes = sql(`SELECT GROUP_CONCAT(price_source ORDER BY variant_id) FROM sale_items WHERE sale_id=${sale.id}`)
    expect(fuentes).toBe(mode === 'bcv' ? 'bcv,bcv,bcv' : 'divisa,fallback_bcv,divisa')
    expect(Number(sale.total_usd)).toBe(TALLAS.reduce((s, t) => s + ESPERADO[mode][t], 0))
  })
}

test('editor: guardar y leer Full y Divisa propios, con la referencia y el aviso en línea', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.context().addCookies([{ name: 'activopos_session', value: await token(), url: BASE }])
  await page.goto(`/productos/${productId}/editar`)
  await page.getByRole('tab', { name: 'Inventario y variantes' }).click()
  await expect(page.getByTestId('variant-price-ref')).toContainText('$492,00 Full')
  await expect(page.getByTestId('variant-price-ref')).toContainText('$400,00 Divisa')
  // T2 tiene Full propio y no Divisa: aviso en línea; T3 tiene ambos: sin aviso
  await expect(page.getByLabel('Precio Full propio de la talla T2')).toHaveValue('450')
  await expect(page.getByLabel('Precio Divisa propio de la talla T2')).toHaveValue('')
  await expect(page.getByLabel('Precio Divisa propio de la talla T3')).toHaveValue('380')
  await expect(page.getByText('Esta talla no tendrá precio Divisa: en Divisa se cobrará el Full')).toHaveCount(1)
  await page.getByTestId('variant-price-ref').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(SHOTS, 'variantes-divisa-editor-1280.png') })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByLabel('Precio Full propio de la talla T2').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(SHOTS, 'variantes-divisa-editor-375.png') })
  await page.setViewportSize({ width: 1280, height: 900 })

  // Dar Divisa a T2 y guardar: queda en la DB y el aviso desaparece
  await page.getByLabel('Precio Divisa propio de la talla T2').fill('410')
  await expect(page.getByText('Esta talla no tendrá precio Divisa: en Divisa se cobrará el Full')).toHaveCount(0)
  await page.getByRole('button', { name: /Guardar/ }).first().click()
  await expect.poll(() => Number(sql(`SELECT IFNULL(divisa_price_usd,-1) FROM product_variants WHERE id=${variantId.T2}`)), { timeout: 20_000 }).toBe(410)
  // T1 sin precios propios sigue nulo; T3 no cambió
  expect(sql(`SELECT IFNULL(CONCAT(price_usd),'null') FROM product_variants WHERE id=${variantId.T1}`)).toBe('null')
  expect(sql(`SELECT IFNULL(divisa_price_usd,-1) FROM product_variants WHERE id=${variantId.T3}`)).toBe('380')
})
