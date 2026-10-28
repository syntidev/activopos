import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Vitrina de marca (/catalogo-premium/[slug]/marca/[marca]): catálogo premium acotado a UNA marca, sin enlaces
 * al resto del catálogo. Negocio 80 (slug boutique-demo); datos ZZ, plantilla premium temporal.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 80
const ADMIN_ID = 79
const SLUG = 'boutique-demo'
const VITRINA = `/catalogo-premium/${SLUG}/marca/zz-vitrina`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let originalTemplate = ''
const ids: Record<'uno' | 'dos' | 'ajeno' | 'sinMarca', number> = { uno: 0, dos: 0, ajeno: 0, sinMarca: 0 }

async function token(): Promise<string> {
  return new SignJWT({ userId: ADMIN_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
}

function cleanup(): void {
  const list = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Vit%'`).split('\n').filter(Boolean).join(',')
  if (list) {
    sql(`DELETE FROM inventory_entries WHERE product_id IN (${list})`)
    sql(`DELETE FROM product_variants WHERE product_id IN (${list})`)
    sql(`DELETE FROM product_collections WHERE product_id IN (${list})`)
    sql(`DELETE FROM products WHERE business_id=${BUSINESS_ID} AND id IN (${list})`)
  }
  sql(`DELETE FROM brands WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ%'`)
}

const count = (table: 'products' | 'brands'): number =>
  Number(sql(`SELECT COUNT(*) FROM ${table} WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ%'`))

async function crearMarca(name: string, visible: boolean): Promise<number> {
  const r = await api.post('/api/brands', { data: { name, search_term: name.toLowerCase(), visible } })
  expect(r.status(), await r.text()).toBeLessThan(300)
  return Number(sql(`SELECT id FROM brands WHERE business_id=${BUSINESS_ID} AND name='${name}'`))
}

async function crearProducto(name: string, brandId: number | null): Promise<number> {
  const r = await api.post('/api/products', {
    data: {
      name, cost_per_unit_usd: 5, price_per_unit_usd: 10, stock_quantity: 5,
      show_in_catalog: true, catalog_visibility: 'visible', ...(brandId ? { brand_id: brandId } : {}),
    },
  })
  expect(r.status(), await r.text()).toBe(201)
  return ((await r.json()) as { product: { id: number } }).product.id
}

test.beforeAll(async () => {
  cleanup()
  originalTemplate = sql(`SELECT catalog_template FROM businesses WHERE id=${BUSINESS_ID}`)
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BUSINESS_ID}`)
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  const marca = await crearMarca('ZZ Vitrina', true)
  const otra = await crearMarca('ZZ Vitrina Otra', true)
  await crearMarca('ZZ Oculta', false)
  ids.uno = await crearProducto('ZZ Vit Reloj Uno', marca)
  ids.dos = await crearProducto('ZZ Vit Reloj Dos', marca)
  ids.ajeno = await crearProducto('ZZ Vit Ajeno', otra)
  ids.sinMarca = await crearProducto('ZZ Vit Sin Marca', null)
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

/** Abre la ruta reintentando: el servidor de desarrollo compila la primera vez y el catálogo cachea 60 s. */
async function abrir(page: Page, url: string, visible: string): Promise<void> {
  await expect(async () => {
    await page.goto(url)
    await expect(page.getByText(visible, { exact: true }).first()).toBeVisible({ timeout: 8000 })
  }).toPass({ timeout: 90_000 })
}

/** Destinos internos (href que empiezan con "/") de la página actual. */
const internalHrefs = (page: Page): Promise<string[]> =>
  page.locator('a[href^="/"]').evaluateAll(as => as.map(a => a.getAttribute('href') ?? ''))

test('solo salen los productos de la marca, sin selector de marcas', async ({ page }) => {
  await abrir(page, VITRINA, 'ZZ Vit Reloj Uno')
  await expect(page.getByText('ZZ Vit Reloj Dos', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('ZZ Vit Ajeno', { exact: true })).toHaveCount(0)
  await expect(page.getByText('ZZ Vit Sin Marca', { exact: true })).toHaveCount(0)
  await expect(resultCount(page)).toHaveText('2 productos')
  await expect(page.getByRole('heading', { name: 'ZZ Vitrina', exact: true })).toBeVisible()

  // La búsqueda y los filtros trabajan solo dentro de la marca: el producto ajeno no aparece aunque coincida.
  await page.locator('input[type="search"]:visible').first().fill('ZZ Vit Ajeno')
  await expect(page.getByText('ZZ Vit Ajeno', { exact: true })).toHaveCount(0)
  await page.locator('input[type="search"]:visible').first().fill('')
  await page.getByRole('button', { name: /Filtros/ }).click()
  await expect(page.getByRole('heading', { name: 'Marca', exact: true })).toHaveCount(0)
})

test('no hay enlaces al catálogo global (header, tab bar, menú, footer, tarjetas)', async ({ page }) => {
  await abrir(page, VITRINA, 'ZZ Vit Reloj Uno')
  await expect(page.getByRole('link', { name: /^(Inicio|Tienda|Marcas|Catálogo|200K)$/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tienda', exact: true })).toHaveCount(0)

  // Todo destino interno es la vitrina o una ficha de la misma marca con el contexto.
  const permitido = new RegExp(`^(${VITRINA}(\\?.*)?|/catalogo-premium/${SLUG}/p/(${ids.uno}|${ids.dos})\\?vitrina=zz-vitrina)$`)
  const malos = (await internalHrefs(page)).filter(h => !permitido.test(h))
  expect(malos, `enlaces fuera de la vitrina: ${malos.join(', ')}`).toEqual([])
})

test('en móvil la tab bar lleva Inicio a la vitrina y no tiene Tienda', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await abrir(page, VITRINA, 'ZZ Vit Reloj Uno')
  const tabs = page.getByRole('navigation', { name: 'Navegación móvil' })
  await expect(tabs.getByRole('button', { name: 'Tienda' })).toHaveCount(0)

  // Menú hamburguesa (solo móvil): únicamente "Inicio" (a la vitrina), nunca "Catálogo".
  await page.getByRole('button', { name: 'Ver todas las categorías' }).click()
  await expect(page.getByRole('menuitem', { name: 'Catálogo' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Inicio' })).toHaveAttribute('href', VITRINA)
  await page.getByRole('menuitem', { name: 'Inicio' }).click()
  await expect(page).toHaveURL(new RegExp(`${VITRINA}$`))

  await tabs.getByRole('button', { name: 'Buscar' }).click()
  await tabs.getByRole('button', { name: 'Inicio' }).click()
  await expect(page).toHaveURL(new RegExp(`${VITRINA}$`))
})

test('la ficha conserva el modo vitrina y vuelve a la vitrina', async ({ page }) => {
  await abrir(page, VITRINA, 'ZZ Vit Reloj Uno')
  await page.getByText('ZZ Vit Reloj Uno', { exact: true }).first().click()
  await expect(page).toHaveURL(new RegExp(`/p/${ids.uno}\\?vitrina=zz-vitrina$`))
  await expect(page.getByRole('heading', { name: 'ZZ Vit Reloj Uno' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^(Inicio|Tienda|Marcas)$/ })).toHaveCount(0)

  // Relacionados y anterior/siguiente: solo de la misma marca y siempre con el contexto.
  const fichas = (await internalHrefs(page)).filter(h => h.includes('/p/'))
  for (const h of fichas) expect(h, h).toMatch(new RegExp(`/p/(${ids.uno}|${ids.dos})\\?vitrina=zz-vitrina$`))
  expect(fichas.some(h => h.includes(`/p/${ids.dos}?`))).toBe(true)
  const fuera = (await internalHrefs(page)).filter(h => /\/productos|#marcas|\/kit-200k/.test(h) || h === `/catalogo-premium/${SLUG}`)
  expect(fuera, `enlaces al catálogo global: ${fuera.join(', ')}`).toEqual([])

  await page.getByRole('link', { name: 'Volver a ZZ Vitrina' }).click()
  await expect(page).toHaveURL(new RegExp(`${VITRINA}$`))
})

test('agregar al carrito en la vitrina y llegar al checkout', async ({ page }) => {
  await abrir(page, VITRINA, 'ZZ Vit Reloj Uno')
  await page.getByRole('button', { name: 'Agregar ZZ Vit Reloj Uno al carrito' }).first().click()
  await expect(async () => {
    await page.getByRole('button', { name: /^Carrito/ }).first().click({ timeout: 4000 })
    await page.getByRole('button', { name: 'Finalizar por WhatsApp' }).click({ timeout: 4000 })
  }).toPass({ timeout: 30_000 })
  await expect(page.getByTestId('checkout-name')).toBeVisible()
})

test('marca inexistente u oculta da 404', async ({ page }) => {
  for (const marca of ['zz-no-existe', 'zz-oculta']) {
    await expect(async () => {
      const r = await page.goto(`/catalogo-premium/${SLUG}/marca/${marca}`)
      expect(r?.status()).toBe(404)
    }).toPass({ timeout: 90_000 })
  }
})

test('sin contexto vitrina la ficha y el catálogo siguen igual', async ({ page }) => {
  await abrir(page, `/catalogo-premium/${SLUG}/p/${ids.uno}`, 'ZZ Vit Reloj Uno')
  await expect(page.getByRole('link', { name: 'Tienda', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Volver al catálogo' })).toBeVisible()

  // Un ?vitrina= de otra marca (no es la del producto) se ignora: ficha normal.
  await page.goto(`/catalogo-premium/${SLUG}/p/${ids.uno}?vitrina=zz-vitrina-otra`)
  await expect(page.getByRole('link', { name: 'Tienda', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /^Volver a / })).toHaveCount(0)

  await page.goto(`/catalogo-premium/${SLUG}/productos`)
  await expect(page.getByRole('heading', { name: 'Catálogo de Productos' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tienda', exact: true }).first()).toBeVisible()
})
