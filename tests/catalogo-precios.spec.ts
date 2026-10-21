import { test, expect } from '@playwright/test'
import { sql } from './alta-helpers'
import { BASE, BUSINESS_ID, SLUG, apiAs, cleanupTestProducts } from './p0-helpers'

/**
 * P0 precios del catálogo público (negocio 87): muestra SIEMPRE price_per_unit_usd, sin tachado.
 * Reproduce los datos reales de OnBike: venta 492, mayorista 400 y precio_divisa 400 (el valor que antes se
 * pintaba como "~~$492~~ $400", aunque el servidor cobra 492).
 */
const NAME = 'ZZ Precio Kask Elemento'
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })
let pid = 0

test.beforeAll(async () => {
  cleanupTestProducts('Precio')
  const api = await apiAs()
  const r = await api.post('/api/products', {
    data: {
      name: NAME, cost_per_unit_usd: 100, price_per_unit_usd: 492, wholesale_price_usd: 400, stock_quantity: 5,
      show_in_catalog: true, catalog_visibility: 'visible', is_available: true,
    },
  })
  expect(r.status()).toBe(201)
  pid = (await r.json()).product.id as number
  sql(`UPDATE products SET precio_divisa = 400 WHERE id = ${pid} AND business_id = ${BUSINESS_ID}`)
  await api.dispose()
})

test.afterAll(() => { cleanupTestProducts('Precio') })

test('API pública: price_usd es el precio de venta (492), no el mayorista ni el de divisa', async () => {
  const api = await apiAs(null)
  const j = await (await api.get(`/api/catalog/${SLUG}`)).json()
  const p = (j.products as Array<{ id: number; price_usd: number }>).find(x => x.id === pid)
  expect(p?.price_usd).toBe(492)
  await api.dispose()
})

test('catálogo premium, listado: muestra $492 sin tachado y sin $400', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}/productos?buscar=${encodeURIComponent('ZZ Precio')}`)
  await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[class*="priceUsdOld"], [class*="compactPriceOld"]')).toHaveCount(0)
  const body = await page.locator('body').innerText()
  expect(body).toContain('492')
  expect(body).not.toMatch(/\$\s?400/)
})

test('catálogo premium, ficha: $492 sin tachado y sin $400', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}/p/${pid}`)
  await expect(page.getByRole('heading', { name: NAME })).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[class*="priceUsdOld"]')).toHaveCount(0)
  const body = await page.locator('body').innerText()
  expect(body).toContain('492')
  expect(body).not.toMatch(/\$\s?400/)
})

test('catálogo normal, listado y ficha: $492 sin tachado y sin $400', async ({ page }) => {
  await page.goto(`/catalogo/${SLUG}/productos`)
  const box = page.locator('input[type=search]').first()
  await box.waitFor({ state: 'visible', timeout: 60_000 })
  await box.fill('ZZ Precio')
  await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 30_000 })
  let body = await page.locator('body').innerText()
  expect(body).toContain('492')
  expect(body).not.toMatch(/\$\s?400/)
  await page.goto(`/catalogo/${SLUG}/p/${pid}`)
  await expect(page.getByRole('heading', { name: NAME })).toBeVisible({ timeout: 60_000 })
  body = await page.locator('body').innerText()
  expect(body).toContain('492')
  expect(body).not.toMatch(/\$\s?400/)
})
