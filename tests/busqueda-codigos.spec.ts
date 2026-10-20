import { test, expect } from '@playwright/test'
import { sql } from './alta-helpers'
import { BASE, BUSINESS_ID, SLUG, apiAs, cleanupTestProducts, login } from './p0-helpers'

/**
 * T4 búsqueda por código y SKU de variante (negocio 87). Caso real de prod: producto con tallas XS y M, cada una
 * con barcode y sku propios; pegar el código en Productos / catálogo no devolvía nada. Un test por buscador con el
 * flujo de la pistola: escribir el código + Enter.
 */
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

const NAME = 'ZZ Busq Girona Colors Gris'
const REF = 'ZZ21216H'
const XS = { barcode: '7799900000011', sku: 'ZZ21216H UNICO COLOR XS' }
const M = { barcode: '7799900000028', sku: 'ZZ21216H UNICO COLOR M' }
const HIDDEN = 'ZZ Busq Oculto'
const HIDDEN_BARCODE = '7799900000035'

interface ProductHit { id: number; matched_variant_id: number | null; matched_variant_value: string | null }
let pid = 0
let xsId = 0

test.beforeAll(async () => {
  cleanupTestProducts('Busq')
  const api = await apiAs()
  const r = await api.post('/api/products', {
    data: {
      name: NAME, description: `Pantaloneta ciclismo. Ref: ${REF}`, cost_per_unit_usd: 10, price_per_unit_usd: 25, has_variants: true,
      show_in_catalog: true, catalog_visibility: 'visible', is_available: true,
      variants: [
        { tipo: 'talla', valor: 'XS', stock: 3, sku: XS.sku, barcode: XS.barcode },
        { tipo: 'talla', valor: 'M', stock: 3, sku: M.sku, barcode: M.barcode },
      ],
    },
  })
  expect(r.status()).toBe(201)
  pid = (await r.json()).product.id as number
  xsId = Number(sql(`SELECT id FROM product_variants WHERE product_id=${pid} AND valor='XS'`))
  const h = await api.post('/api/products', {
    data: { name: HIDDEN, cost_per_unit_usd: 5, price_per_unit_usd: 9, stock_quantity: 3, barcode: HIDDEN_BARCODE, show_in_catalog: false, catalog_visibility: 'hidden', is_available: true },
  })
  expect(h.status()).toBe(201)
  await api.dispose()
})
test.afterAll(() => { cleanupTestProducts('Busq') })

test.describe('Productos (GET /api/products?search=)', () => {
  const casos: Array<[string, string, string]> = [
    ['barcode de variante XS', XS.barcode, 'XS'],
    ['barcode de variante M', M.barcode, 'M'],
    ['sku de variante M', M.sku, 'M'],
    ['barcode con espacios alrededor (pegado)', ` ${XS.barcode} `, 'XS'],
    ['barcode con espacio dentro', '7799 900000011', 'XS'],
  ]
  for (const [titulo, q, talla] of casos) {
    test(`encuentra por ${titulo} y devuelve la talla`, async () => {
      const api = await apiAs()
      const j = await (await api.get(`/api/products?search=${encodeURIComponent(q)}`)).json() as { products: ProductHit[] }
      const hit = j.products.find(p => p.id === pid)
      expect(hit, `sin resultado para "${q}"`).toBeTruthy()
      expect(hit?.matched_variant_value).toBe(talla)
      await api.dispose()
    })
  }
  test('encuentra por "Ref" de la descripción, con y sin la palabra Ref', async () => {
    const api = await apiAs()
    for (const q of [`Ref: ${REF}`, REF, 'ref zz21216h']) {
      const j = await (await api.get(`/api/products?search=${encodeURIComponent(q)}`)).json() as { products: ProductHit[] }
      expect(j.products.some(p => p.id === pid), `sin resultado para "${q}"`).toBe(true)
    }
    await api.dispose()
  })
  test('UI: escribir el barcode de la talla M + Enter deja ese producto en la lista', async ({ page }) => {
    await login(page)
    await page.goto('/productos')
    const box = page.getByPlaceholder(/Nombre, SKU/)
    await box.fill(M.barcode)
    await box.press('Enter')
    await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 30_000 })
  })
})

test.describe('POS (GET /api/products/search?q=)', () => {
  test('barcode exacto de variante: primer resultado es el producto con la talla coincidida', async () => {
    const api = await apiAs()
    const j = await (await api.get(`/api/products/search?q=${M.barcode}`)).json() as { products: ProductHit[] }
    expect(j.products[0]).toMatchObject({ id: pid, matched_variant_value: 'M' })
    await api.dispose()
  })
  test('sku y Ref también', async () => {
    const api = await apiAs()
    const bySku = await (await api.get(`/api/products/search?q=${encodeURIComponent(XS.sku)}`)).json() as { products: ProductHit[] }
    expect(bySku.products[0]).toMatchObject({ id: pid, matched_variant_id: xsId })
    const byRef = await (await api.get(`/api/products/search?q=${encodeURIComponent('Ref: ' + REF)}`)).json() as { products: ProductHit[] }
    expect(byRef.products.some(p => p.id === pid)).toBe(true)
    await api.dispose()
  })
  test('UI /pos: código de talla XS + Enter y luego M + Enter agregan DOS líneas (una por talla), sin selector', async ({ page }) => {
    await login(page)
    await page.goto('/pos')
    const box = page.getByPlaceholder('Buscar producto o código...')
    await box.waitFor({ state: 'visible', timeout: 60_000 })
    for (const code of [XS.barcode, M.barcode]) {
      const respuesta = page.waitForResponse(r => r.url().includes('/api/products/search') && r.ok(), { timeout: 15_000 })
      await box.fill(code)
      await respuesta
      await box.press('Enter')
      await expect(box).toHaveValue('', { timeout: 10_000 })
    }
    // El ticket no pinta la talla (pendiente CLI-B); la prueba es que quedaron dos líneas y que no se abrió el selector.
    await expect(page.getByText('1 und', { exact: true })).toHaveCount(2, { timeout: 15_000 })
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test.describe('Catálogo público', () => {
  test('API: encuentra por barcode/sku de variante y solo entre productos visibles', async () => {
    const api = await apiAs(null)
    const porBarcode = await (await api.get(`/api/catalog/${SLUG}/search?q=${M.barcode}`)).json() as { results: Array<{ id: number; matched_variant_value: string | null }> }
    expect(porBarcode.results[0]).toMatchObject({ id: pid, matched_variant_value: 'M' })
    const porSku = await (await api.get(`/api/catalog/${SLUG}/search?q=${encodeURIComponent(XS.sku)}`)).json() as { results: Array<{ id: number; matched_variant_value: string | null }> }
    expect(porSku.results[0]).toMatchObject({ id: pid, matched_variant_value: 'XS' })
    const oculto = await (await api.get(`/api/catalog/${SLUG}/search?q=${HIDDEN_BARCODE}`)).json() as { results: unknown[] }
    expect(oculto.results).toHaveLength(0)
    await api.dispose()
  })
  for (const base of ['catalogo-premium', 'catalogo']) {
    test(`UI /${base}: código de la talla XS + Enter abre la ficha del producto`, async ({ page }) => {
      await page.goto(`/${base}/${SLUG}/productos`)
      const box = page.locator('input[type=search]').first()
      await box.waitFor({ state: 'visible', timeout: 60_000 })
      await box.fill(XS.barcode)
      await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 30_000 })
      await box.press('Enter')
      await expect(page).toHaveURL(new RegExp(`/${base}/${SLUG}/p/${pid}`), { timeout: 30_000 })
    })
  }
})

test.describe('Alta rápida (GET /api/quick-add/lookup?code=)', () => {
  test('barcode y SKU de variante devuelven el producto con la talla', async () => {
    const api = await apiAs()
    const a = await (await api.get(`/api/quick-add/lookup?code=${XS.barcode}`)).json() as { existing: { id: number; matched_variant_value?: string } | null }
    expect(a.existing).toMatchObject({ id: pid, matched_variant_value: 'XS' })
    const b = await api.get(`/api/quick-add/lookup?code=${encodeURIComponent(M.sku)}`)
    expect(b.status()).toBe(200)
    expect((await b.json()).existing).toMatchObject({ id: pid, matched_variant_value: 'M' })
    await api.dispose()
  })
})

test('aislamiento: un código de otro negocio no devuelve productos que no sean del 87', async () => {
  const otro = sql(`SELECT barcode FROM products WHERE business_id <> ${BUSINESS_ID} AND barcode IS NOT NULL AND barcode <> '' LIMIT 1`)
  test.skip(!otro, 'no hay productos de otros negocios en la DB local')
  const api = await apiAs()
  const j = await (await api.get(`/api/products/search?q=${encodeURIComponent(otro)}`)).json() as { products: Array<{ id: number }> }
  for (const p of j.products) expect(Number(sql(`SELECT business_id FROM products WHERE id=${p.id}`))).toBe(BUSINESS_ID)
  await api.dispose()
})
