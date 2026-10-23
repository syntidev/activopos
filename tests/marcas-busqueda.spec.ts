import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * "Comprá por marca" (catálogo premium): el clic en una marca abre /productos con su "Término de búsqueda" cargado
 * en el input y los resultados ya filtrados. Negocio 80 (slug boutique-demo); datos ZZ, plantilla premium temporal.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 80
const ADMIN_ID = 79
const SLUG = 'boutique-demo'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let originalTemplate = ''

const BRANDS = [
  { name: 'ZZ Garmin', term: 'forerunner' },           // término distinto al nombre
  { name: 'ZZ Relojes', term: 'zz reloj gps' },          // varias palabras (AND entre palabras)
  { name: 'ZZ Camaras', term: 'zz cámara' },             // con acento y espacio
]

async function token(): Promise<string> {
  return new SignJWT({ userId: ADMIN_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
}

function cleanup(): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Marcas%'`).split('\n').filter(Boolean)
  if (ids.length > 0) {
    const list = ids.join(',')
    sql(`DELETE FROM inventory_entries WHERE product_id IN (${list})`)
    sql(`DELETE FROM product_variants WHERE product_id IN (${list})`)
    sql(`DELETE FROM product_collections WHERE product_id IN (${list})`)
    sql(`DELETE FROM products WHERE business_id=${BUSINESS_ID} AND id IN (${list})`)
  }
  sql(`DELETE FROM brands WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ%'`)
}

const count = (table: 'products' | 'brands'): number =>
  Number(sql(`SELECT COUNT(*) FROM ${table} WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ%'`))

test.beforeAll(async () => {
  cleanup()
  originalTemplate = sql(`SELECT catalog_template FROM businesses WHERE id=${BUSINESS_ID}`)
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BUSINESS_ID}`)
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  for (const b of BRANDS) {
    const r = await api.post('/api/brands', { data: { name: b.name, search_term: b.term } })
    expect(r.status(), await r.text()).toBeLessThan(300)
  }
  const mk = async (name: string) => {
    const r = await api.post('/api/products', {
      data: { name, cost_per_unit_usd: 5, price_per_unit_usd: 10, stock_quantity: 5, show_in_catalog: true, catalog_visibility: 'visible' },
    })
    expect(r.status(), await r.text()).toBe(201)
  }
  await mk('ZZ Marcas Forerunner 255')
  await mk('ZZ Marcas Reloj Deportivo GPS')
  await mk('ZZ Marcas Cámara Acción')
  await mk('ZZ Marcas Otro Producto')
})

test.afterAll(async () => {
  cleanup()
  sql(`UPDATE businesses SET catalog_template='${originalTemplate}' WHERE id=${BUSINESS_ID}`)
  await api.dispose()
  // Confirmación: cero datos ZZ y plantilla original restaurada.
  expect(count('products')).toBe(0)
  expect(count('brands')).toBe(0)
  expect(sql(`SELECT catalog_template FROM businesses WHERE id=${BUSINESS_ID}`)).toBe(originalTemplate)
})

const resultCount = (page: Page) => page.getByText(/^\d+ productos?$/)
const searchBox = (page: Page) => page.locator('input[type="search"]:visible').first()

async function abrirMarca(page: Page, name: string): Promise<void> {
  await expect(async () => {
    await page.goto(`/catalogo-premium/${SLUG}`)
    await page.getByRole('link', { name }).first().click({ timeout: 8000 })
  }).toPass({ timeout: 90_000 })
}

test('clic en la marca: URL con el término, input cargado y solo los productos que coinciden', async ({ page }) => {
  await abrirMarca(page, 'ZZ Garmin')
  await expect(page).toHaveURL(/\/productos\?buscar=forerunner$/)
  await expect(searchBox(page)).toHaveValue('forerunner')
  await expect(page.getByText('ZZ Marcas Forerunner 255', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('ZZ Marcas Otro Producto', { exact: true })).toHaveCount(0)
  await expect(resultCount(page)).toHaveText('1 producto')
})

test('varias palabras: AND entre palabras aunque no sean contiguas en el nombre', async ({ page }) => {
  await abrirMarca(page, 'ZZ Relojes')
  await expect(page).toHaveURL(/\/productos\?buscar=zz%20reloj%20gps$/)
  await expect(searchBox(page)).toHaveValue('zz reloj gps')
  await expect(page.getByText('ZZ Marcas Reloj Deportivo GPS', { exact: true }).first()).toBeVisible()
  await expect(resultCount(page)).toHaveText('1 producto')
})

test('acento y espacio: "zz cámara" encuentra "Cámara"', async ({ page }) => {
  await abrirMarca(page, 'ZZ Camaras')
  await expect(page).toHaveURL(/\/productos\?buscar=zz%20c%C3%A1mara$/)
  await expect(searchBox(page)).toHaveValue('zz cámara')
  await expect(page.getByText('ZZ Marcas Cámara Acción', { exact: true }).first()).toBeVisible()
  await expect(resultCount(page)).toHaveText('1 producto')
})

test('carga directa, recarga y limpiar el input', async ({ page }) => {
  const url = `/catalogo-premium/${SLUG}/productos?buscar=${encodeURIComponent('forerunner')}`
  await expect(async () => {
    await page.goto(url)
    await expect(searchBox(page)).toHaveValue('forerunner', { timeout: 8000 })
  }).toPass({ timeout: 90_000 })
  await expect(resultCount(page)).toHaveText('1 producto')

  await page.reload()
  await expect(searchBox(page)).toHaveValue('forerunner')
  await expect(resultCount(page)).toHaveText('1 producto')

  await searchBox(page).fill('')
  await expect(resultCount(page)).not.toHaveText('1 producto')
})

test('marca sin término: el tile no rompe nada y no agrega ?buscar=', async ({ page }) => {
  sql(`INSERT INTO brands (business_id, name, search_term, \`order\`, visible) VALUES (${BUSINESS_ID}, 'ZZ Sin Termino', '', 9, 1)`)
  await expect(async () => {
    await page.goto(`/catalogo-premium/${SLUG}`)
    await expect(page.getByRole('link', { name: 'ZZ Sin Termino' }).first()).toBeVisible({ timeout: 8000 })
  }).toPass({ timeout: 90_000 })
  await page.getByRole('link', { name: 'ZZ Sin Termino' }).first().click()
  await expect(page).toHaveURL(new RegExp(`/catalogo-premium/${SLUG}/productos$`))
  await expect(resultCount(page)).not.toHaveText(/^(0|1) productos?$/)
})
