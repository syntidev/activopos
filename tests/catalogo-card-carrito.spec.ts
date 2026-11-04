import { test, expect, request as pwRequest, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * "+" de ProductCard en todas las secciones + Cartelera 1+4. Negocio 80, plantilla premium mientras dura la prueba, datos ZZ con limpieza.
 * Cartelera ZZ = 4 productos simples + 1 con talla (el 5.º, no hero). Una landing collection_grid ZZ apunta a la misma colección.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BID = 80
const SLUG = 'boutique-demo'
const TAG = String(Date.now()).slice(-6)
const NOMBRES = [1, 2, 3, 4].map(n => `ZZ Card ${n} ${TAG}`)
const CON_TALLA = `ZZ Card Talla ${TAG}`
const COL_SLUG = `zz-card-${TAG}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let idTalla = 0
let templateOriginal = 'generic'
let carteleraPrevia = ''

const token = () => new SignJWT({ userId: 79, businessId: BID, role: 'admin', name: 'Admin Demo' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
  .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

function limpiar(): void {
  const col = sql(`SELECT id FROM collections WHERE business_id=${BID} AND slug LIKE 'zz-card-%'`).split('\n').filter(Boolean).join(',')
  if (col) {
    sql(`DELETE FROM landing_sections WHERE business_id=${BID} AND type='collection_grid' AND JSON_EXTRACT(config,'$.collection_id') IN (${col})`)
    sql(`DELETE FROM product_collections WHERE collection_id IN (${col})`)
    sql(`DELETE FROM collections WHERE business_id=${BID} AND id IN (${col})`)
  }
  const ids = sql(`SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Card %'`).split('\n').filter(Boolean).join(',')
  if (!ids) return
  sql(`DELETE FROM product_variants WHERE product_id IN (${ids})`)
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND id IN (${ids})`)
}

test.beforeAll(async () => {
  templateOriginal = sql(`SELECT catalog_template FROM businesses WHERE id=${BID}`) || 'generic'
  if (templateOriginal === 'premium') templateOriginal = 'generic'
  limpiar()
  carteleraPrevia = sql(`SELECT id FROM collections WHERE business_id=${BID} AND is_cartelera_activa=1`).split('\n').filter(Boolean).join(',')
  if (carteleraPrevia) sql(`UPDATE collections SET is_cartelera_activa=0 WHERE id IN (${carteleraPrevia})`)
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BID}`)
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  const mk = async (name: string): Promise<number> => {
    const r = await api.post('/api/products', { data: { name, is_fixed_price: true, cost_per_unit_usd: 5, price_per_unit_usd: 40, stock_quantity: 10, catalog_visibility: 'visible' } })
    expect(r.status(), await r.text()).toBe(201)
    return ((await r.json()) as { product: { id: number } }).product.id
  }
  const ids: number[] = []
  for (const n of NOMBRES) ids.push(await mk(n))
  idTalla = await mk(CON_TALLA)
  ids.push(idTalla)
  const v = await api.post(`/api/products/${idTalla}/variants`, { data: { tipo: 'talla', valor: 'M', stock: 5 } })
  expect(v.status(), await v.text()).toBe(201)
  sql(`UPDATE products SET has_variants=1 WHERE id=${idTalla}`)
  sql(`UPDATE products SET images='["/brand/cashea.png"]' WHERE id IN (${ids.join(',')})`)
  sql(`INSERT INTO collections (business_id,slug,name,active,is_cartelera_activa) VALUES (${BID},'${COL_SLUG}','ZZ Card Campaña ${TAG}',1,1)`)
  const col = sql(`SELECT id FROM collections WHERE business_id=${BID} AND slug='${COL_SLUG}'`)
  sql(`INSERT INTO product_collections (product_id,collection_id) VALUES ${ids.map(i => `(${i},${col})`).join(',')}`)
  sql(`INSERT INTO landing_sections (business_id,type,\`order\`,visible,config,updated_at) VALUES (${BID},'collection_grid',99,1,JSON_OBJECT('collection_id',${col}),NOW())`)
})

test.afterAll(async () => {
  limpiar()
  sql(`UPDATE businesses SET catalog_template='${templateOriginal}' WHERE id=${BID}`)
  if (carteleraPrevia) sql(`UPDATE collections SET is_cartelera_activa=1 WHERE id IN (${carteleraPrevia})`)
  await api?.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Card %'`))).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM collections WHERE business_id=${BID} AND slug LIKE 'zz-card-%'`))).toBe(0)
})

async function cuenta(page: Page): Promise<number> {
  const label = (await page.locator('[aria-label^="Carrito — "]').first().getAttribute('aria-label')) ?? ''
  return Number(/(\d+)/.exec(label)?.[1] ?? '0')
}

async function agregar(page: Page, boton: Locator): Promise<void> {
  const antes = await cuenta(page)
  await boton.scrollIntoViewIfNeeded()
  await boton.click()
  await expect.poll(() => cuenta(page)).toBe(antes + 1)
}

test('"+" en la Cartelera agrega al carrito y el producto con talla abre la ficha', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}`)
  const cartelera = page.locator('[data-section="cartelera"]')
  await expect(cartelera.locator('article')).toHaveCount(5)
  await agregar(page, cartelera.getByRole('button', { name: `Agregar ${NOMBRES[1]} al carrito` }))
  await cartelera.getByRole('button', { name: `Ver opciones de ${CON_TALLA}` }).click()
  await expect(page).toHaveURL(new RegExp(`/p/${idTalla}`))
})

test('"+" en una colección de la landing agrega al carrito', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}`)
  const coleccion = page.locator('section:not([data-section="cartelera"]):not([data-section="novedades"]) article').filter({ hasText: NOMBRES[2] })
  await agregar(page, coleccion.first().getByRole('button', { name: `Agregar ${NOMBRES[2]} al carrito` }))
})

test('"+" en Novedades agrega al carrito', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}`)
  const novedades = page.locator('[data-section="novedades"]')
  await expect(novedades).toBeVisible()
  await agregar(page, novedades.locator('button[aria-label^="Agregar "]').first())
})

test('Cartelera 1+4 a 1280: hero 2×2 a la izquierda y 4 tarjetas iguales', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/catalogo-premium/${SLUG}`)
  const a = page.locator('[data-section="cartelera"] article')
  await expect(a).toHaveCount(5)
  await a.first().scrollIntoViewIfNeeded()
  const [hero, ...resto] = await Promise.all([0, 1, 2, 3, 4].map(async i => (await a.nth(i).boundingBox())!))
  expect(hero.width).toBeGreaterThan(resto[0].width * 1.8)
  expect(hero.height).toBeGreaterThan(resto[0].height * 1.8)
  expect(Math.abs(resto[0].width - resto[3].width)).toBeLessThan(2)
  expect(Math.abs(resto[0].y - resto[1].y)).toBeLessThan(2)
  expect(resto[0].x).toBeGreaterThan(hero.x + hero.width - 2)
  await page.locator('[data-section="cartelera"]').screenshot({ path: 'tests/__capturas__/cartelera-1280.png' })
})

test('Cartelera a 375: hero arriba y las 4 en 2×2, sin scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto(`/catalogo-premium/${SLUG}`)
  const a = page.locator('[data-section="cartelera"] article')
  await expect(a).toHaveCount(5)
  await a.first().scrollIntoViewIfNeeded()
  const [hero, ...r] = await Promise.all([0, 1, 2, 3, 4].map(async i => (await a.nth(i).boundingBox())!))
  expect(hero.width).toBeGreaterThan(r[0].width * 1.8)
  expect(r[0].y).toBeGreaterThan(hero.y + hero.height - 2)
  expect(Math.abs(r[0].y - r[1].y)).toBeLessThan(2)
  expect(Math.abs(r[2].y - r[3].y)).toBeLessThan(2)
  expect(r[2].y).toBeGreaterThan(r[0].y + r[0].height - 2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.locator('[data-section="cartelera"]').screenshot({ path: 'tests/__capturas__/cartelera-375.png' })
})
