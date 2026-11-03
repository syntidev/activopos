import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Precio Divisa principal en el catálogo premium. Negocio 80 (se pone en plantilla premium y con medios divisa
 * 313 + 315 mientras dura la prueba; todo se restaura al final). Productos ZZ con limpieza.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BID = 80
const SLUG = 'boutique-demo'
const TAG = String(Date.now()).slice(-6)
const CON = `ZZ Divisa Con ${TAG}`
const SIN = `ZZ Divisa Sin ${TAG}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let idCon = 0
let idSin = 0
let templateOriginal = 'generic'

const token = () => new SignJWT({ userId: 79, businessId: BID, role: 'admin', name: 'Admin Demo' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
  .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

function restaurar(): void {
  sql(`UPDATE businesses SET catalog_template='${templateOriginal}', settings=JSON_REMOVE(COALESCE(settings,JSON_OBJECT()),'$.catalog_divisa_methods') WHERE id=${BID}`)
  const ids = sql(`SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Divisa%'`).split('\n').filter(Boolean).join(',')
  if (!ids) return
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND id IN (${ids})`)
}

test.beforeAll(async () => {
  templateOriginal = sql(`SELECT catalog_template FROM businesses WHERE id=${BID}`) || 'generic'
  if (templateOriginal === 'premium') templateOriginal = 'generic'
  restaurar()
  sql(`UPDATE businesses SET catalog_template='premium', settings=JSON_SET(COALESCE(settings,JSON_OBJECT()),'$.catalog_divisa_methods',JSON_ARRAY(313,315)) WHERE id=${BID}`)
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  const mk = async (data: Record<string, unknown>): Promise<number> => {
    const r = await api.post('/api/products', { data: { is_fixed_price: true, cost_per_unit_usd: 5, stock_quantity: 10, catalog_visibility: 'visible', ...data } })
    expect(r.status(), await r.text()).toBe(201)
    return ((await r.json()) as { product: { id: number } }).product.id
  }
  idCon = await mk({ name: CON, price_per_unit_usd: 40, wholesale_price_usd: 30 })
  idSin = await mk({ name: SIN, price_per_unit_usd: 20 })
})

test.afterAll(async () => {
  restaurar()
  await api?.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Divisa%'`))).toBe(0)
})

test('ficha con Divisa: abre en Divisa con su precio y pastillas; Bs muestra el Full en Bs', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}/p/${idCon}`)
  const bloque = page.getByTestId('precio-divisa')
  await expect(bloque.getByRole('radio', { name: /Divisa/ })).toHaveAttribute('aria-checked', 'true')
  await expect(bloque.getByTestId('precio-principal')).toHaveText('$30.00')
  const pastillas = bloque.getByRole('list', { name: 'Formas de pago en divisa' })
  await expect(pastillas).toContainText('Efectivo USD')
  await expect(pastillas).toContainText('Zelle')
  await expect(pastillas).not.toContainText('Pago')
  await page.screenshot({ path: 'tests/__capturas__/precio-divisa-ficha-1280.png' })
  await bloque.getByRole('radio', { name: /Bolívares/ }).click()
  await expect(bloque.getByTestId('precio-principal')).toContainText('Bs')
  await expect(bloque).toContainText('Equivale a $40.00')
  await expect(bloque.getByRole('list', { name: 'Formas de pago en bolívares' })).toContainText('Pago')
})

test('ficha sin Divisa: Full como principal, sin selector', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}/p/${idSin}`)
  await expect(page.getByRole('heading', { name: SIN })).toBeVisible()
  await expect(page.getByTestId('precio-divisa')).toHaveCount(0)
  await expect(page.getByText('$20.00').first()).toBeVisible()
})

test('tarjeta: Divisa grande y debajo Bs · Cashea · Full', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}/productos`)
  const card = page.locator('a, article, div').filter({ hasText: CON }).filter({ has: page.locator('[class*="priceUsd"]') }).last()
  await expect(card.locator('[class*="priceUsd"]').first()).toContainText('30.00')
  await expect(card.locator('[class*="priceFullLine"]').first()).toContainText('Cashea · Full $40.00')
  await card.screenshot({ path: 'tests/__capturas__/precio-divisa-tarjeta-1280.png' })
})

test('375 px: sin scroll horizontal y selector debajo de la foto', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto(`/catalogo-premium/${SLUG}/p/${idCon}`)
  const bloque = page.getByTestId('precio-divisa')
  await expect(bloque).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  // La foto del producto = la imagen/placeholder más grande de la página (la ficha de prueba no tiene foto real).
  const fotoBottom = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('img, [class*="gallery"], [class*="mainImage"]'))
    const rects = els.map(e => e.getBoundingClientRect()).filter(r => r.width > 200).sort((a, b) => b.width * b.height - a.width * a.height)
    return rects.length > 0 ? rects[0].bottom + window.scrollY : 0
  })
  const selBox = await bloque.getByRole('radiogroup').boundingBox()
  const sel = selBox && { y: selBox.y + (await page.evaluate(() => window.scrollY)) }
  const foto = { y: 0, height: fotoBottom }
  await page.screenshot({ path: 'tests/__capturas__/precio-divisa-ficha-375.png', fullPage: true })
  expect(foto && sel && sel.y >= foto.y + foto.height - 1).toBe(true)
})
