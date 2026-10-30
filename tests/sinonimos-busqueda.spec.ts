import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Sinónimos de búsqueda del catálogo: sin grupos "maillot" no encuentra "ZZ Camisa"; el admin guarda un grupo en
 * Configuración > Tema Visual y entonces sí (buscador del catálogo y /api/catalog/[slug]/search). Negocio 80
 * (slug boutique-demo), plantilla premium temporal, datos ZZ. Al final: productos ZZ = 0 y la clave search_synonyms quitada.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 80
const ADMIN_ID = 79
const SLUG = 'boutique-demo'
const PRODUCTOS = `/catalogo-premium/${SLUG}/productos`
const CAT_ROPA = 13

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let originalTemplate = ''
let productId = 0

const token = async (): Promise<string> =>
  new SignJWT({ userId: ADMIN_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

const sinonimosEnDb = (): string => sql(`SELECT IFNULL(JSON_EXTRACT(settings,'$.search_synonyms'),'null') FROM businesses WHERE id=${BUSINESS_ID}`)
const zzCount = (): number => Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Camisa%'`))

function cleanup(): void {
  const list = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Camisa%'`).split('\n').filter(Boolean).join(',')
  if (list) {
    sql(`DELETE FROM inventory_entries WHERE product_id IN (${list})`)
    sql(`DELETE FROM product_variants WHERE product_id IN (${list})`)
    sql(`DELETE FROM product_collections WHERE product_id IN (${list})`)
    sql(`DELETE FROM products WHERE business_id=${BUSINESS_ID} AND id IN (${list})`)
  }
  sql(`UPDATE businesses SET settings=JSON_REMOVE(settings,'$.search_synonyms') WHERE id=${BUSINESS_ID}`)
}

test.beforeAll(async () => {
  expect(sinonimosEnDb(), 'el negocio 80 no debe tener sinónimos antes de la prueba').toBe('null')
  cleanup()
  originalTemplate = sql(`SELECT catalog_template FROM businesses WHERE id=${BUSINESS_ID}`)
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BUSINESS_ID}`)
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  const r = await api.post('/api/products', {
    data: { name: 'ZZ Camisa', cost_per_unit_usd: 5, price_per_unit_usd: 10, stock_quantity: 5, category_id: CAT_ROPA, show_in_catalog: true, catalog_visibility: 'visible' },
  })
  expect(r.status(), await r.text()).toBe(201)
  productId = ((await r.json()) as { product: { id: number } }).product.id
})

test.afterAll(async () => {
  cleanup()
  sql(`UPDATE businesses SET catalog_template='${originalTemplate}' WHERE id=${BUSINESS_ID}`)
  await api.dispose()
  // Confirmación: conteo 0, sin sinónimos y plantilla original.
  expect(zzCount()).toBe(0)
  expect(sinonimosEnDb()).toBe('null')
  expect(sql(`SELECT catalog_template FROM businesses WHERE id=${BUSINESS_ID}`)).toBe(originalTemplate)
})

const resultCount = (page: Page) => page.getByText(/^\d+ productos?$/)
const apiIds = async (q: string): Promise<number[]> => {
  const r = await pwRequest.newContext({ baseURL: BASE })
  const res = await r.get(`/api/catalog/${SLUG}/search?q=${encodeURIComponent(q)}`)
  const body = (await res.json()) as { results?: { id: number }[] }
  await r.dispose()
  return (body.results ?? []).map(x => x.id)
}

test('sin sinónimos: "maillot" NO encuentra ZZ Camisa (catálogo y API)', async ({ page }) => {
  await page.goto(`${PRODUCTOS}?buscar=maillot`)
  await expect(resultCount(page)).toHaveText('0 productos')
  expect(await apiIds('maillot')).not.toContain(productId)
  await page.goto(`${PRODUCTOS}?buscar=${encodeURIComponent('zz camisa')}`)
  await expect(resultCount(page)).toHaveText('1 producto')
})

test('admin: valida y guarda un grupo en Configuración', async ({ page }) => {
  await page.context().addCookies([{ name: 'activopos_session', value: await token(), url: BASE }])
  await page.goto('/configuracion')
  await page.getByRole('button', { name: 'Tema Visual' }).click()
  const card = page.getByTestId('sinonimos')
  await expect(card.getByRole('heading', { name: 'Sinónimos de búsqueda' })).toBeVisible()

  // Un grupo con un solo término se rechaza con un mensaje claro y no guarda nada.
  await card.getByRole('button', { name: 'Agregar grupo' }).click()
  await card.getByLabel('Término del grupo 1').fill('maillot')
  await card.getByLabel('Término del grupo 1').press('Enter')
  await card.getByRole('button', { name: 'Guardar sinónimos' }).click()
  await expect(card.getByRole('alert')).toHaveText('Cada grupo necesita al menos 2 términos distintos')
  expect(sinonimosEnDb()).toBe('null')

  // Con dos términos guarda (normalizados: sin tildes ni mayúsculas).
  await card.getByLabel('Término del grupo 1').fill('ZZ Camisa')
  await card.getByLabel('Término del grupo 1').press('Enter')
  await card.getByRole('button', { name: 'Guardar sinónimos' }).click()
  await expect(page.getByText('Sinónimos de búsqueda guardados.')).toBeVisible({ timeout: 30_000 })
  expect(JSON.parse(sinonimosEnDb())).toEqual([['maillot', 'zz camisa']])
})

test('con sinónimos: "maillot" encuentra ZZ Camisa (catálogo, ?buscar= y API)', async ({ page }) => {
  await expect(async () => {
    await page.goto(`${PRODUCTOS}?buscar=maillot`)
    await expect(resultCount(page)).toHaveText('1 producto', { timeout: 6000 })
  }).toPass({ timeout: 90_000, intervals: [2000] })
  await expect(page.getByText('ZZ Camisa', { exact: true }).first()).toBeVisible()
  expect(await apiIds('maillot')).toContain(productId)
  // Entre palabras sigue siendo Y: "maillot rojo" no encuentra nada.
  await page.goto(`${PRODUCTOS}?buscar=${encodeURIComponent('maillot rojo')}`)
  await expect(resultCount(page)).toHaveText('0 productos')
})
