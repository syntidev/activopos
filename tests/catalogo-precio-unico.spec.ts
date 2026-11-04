import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Precio único del catálogo premium (<PrecioDual>): negocio 80, plantilla premium mientras dura la prueba, datos ZZ con limpieza.
 * ZZ Unico Menor: Cashea 40 / Divisa 30. ZZ Unico Mayor: Cashea 40 / Divisa 50 (inválida, como el fēnix 1210 vs 1100).
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BID = 80
const SLUG = 'boutique-demo'
const TAG = String(Date.now()).slice(-6)
const MENOR = `ZZ Unico Menor ${TAG}`
const MAYOR = `ZZ Unico Mayor ${TAG}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let idMenor = 0
let idMayor = 0
let templateOriginal = 'generic'

const token = () => new SignJWT({ userId: 79, businessId: BID, role: 'admin', name: 'Admin Demo' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
  .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

function limpiar(): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Unico %'`).split('\n').filter(Boolean).join(',')
  if (!ids) return
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND id IN (${ids})`)
}

test.beforeAll(async () => {
  templateOriginal = sql(`SELECT catalog_template FROM businesses WHERE id=${BID}`) || 'generic'
  if (templateOriginal === 'premium') templateOriginal = 'generic'
  limpiar()
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BID}`)
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  const mk = async (data: Record<string, unknown>): Promise<number> => {
    const r = await api.post('/api/products', { data: { is_fixed_price: true, cost_per_unit_usd: 5, stock_quantity: 10, catalog_visibility: 'visible', is_featured: true, ...data } })
    expect(r.status(), await r.text()).toBe(201)
    return ((await r.json()) as { product: { id: number } }).product.id
  }
  idMenor = await mk({ name: MENOR, price_per_unit_usd: 40, wholesale_price_usd: 30 })
  idMayor = await mk({ name: MAYOR, price_per_unit_usd: 40, wholesale_price_usd: 50 })
})

test.afterAll(async () => {
  sql(`UPDATE businesses SET catalog_template='${templateOriginal}' WHERE id=${BID}`)
  limpiar()
  await api?.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Unico %'`))).toBe(0)
})

const tarjeta = (page: Page, nombre: string) =>
  page.locator('article').filter({ hasText: nombre }).filter({ has: page.getByTestId('precio-principal') }).first()

test('divisa < full: $divisa grande y debajo [Bs] [Cashea] $full', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}/productos`)
  const c = tarjeta(page, MENOR)
  await expect(c.getByTestId('precio-principal')).toContainText('30.00')
  const l = c.getByTestId('precio-cashea')
  await expect(l).toContainText('Bs')
  await expect(l).toContainText('$40.00')
  await expect(l.locator('img[alt="Cashea"]')).toHaveCount(1)
})

test('divisa >= full: un solo precio ($full) y debajo [Bs] [Cashea] monto en Bs', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}/productos`)
  const c = tarjeta(page, MAYOR)
  await expect(c.getByTestId('precio-principal')).toContainText('40.00')
  await expect(c.getByTestId('precio-principal')).not.toContainText('50.00')
  await expect(c.getByTestId('precio-cashea')).toContainText('Bs. ')
  await expect(c).not.toContainText('$50.00')
})

test('ninguna página del catálogo contiene "Full" ni "· Cashea ·"', async ({ page }) => {
  for (const url of [`/catalogo-premium/${SLUG}`, `/catalogo-premium/${SLUG}/productos`, `/catalogo-premium/${SLUG}/p/${idMenor}`, `/catalogo-premium/${SLUG}/p/${idMayor}`]) {
    await page.goto(url)
    await page.waitForLoadState('networkidle')
    const texto = await page.evaluate(() => document.body.innerText)
    expect(texto, url).not.toMatch(/\bFull\b/)
    expect(texto, url).not.toContain('· Cashea ·')
  }
})

for (const ancho of [375, 1280]) {
  test(`${ancho} px: home y productos sin scroll horizontal, captura del home`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 })
    for (const url of [`/catalogo-premium/${SLUG}`, `/catalogo-premium/${SLUG}/productos`]) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${url} @${ancho}`).toBe(true)
    }
    await page.goto(`/catalogo-premium/${SLUG}`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `tests/__capturas__/precio-unico-home-${ancho}.png`, fullPage: true })
  })
}
