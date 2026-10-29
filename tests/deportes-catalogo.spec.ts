import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import path from 'path'
import { envValue, sql } from './alta-helpers'

/**
 * "¿Qué practicas?" del catálogo premium: chips de categoría en móvil, filtro por deporte (?deporte=),
 * búsqueda por palabras en la descripción y ficha con saltos de línea. Negocio 80 (slug boutique-demo);
 * datos ZZ, plantilla premium temporal. Capturas en tests/__capturas__/deportes/.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 80
const ADMIN_ID = 79
const SLUG = 'boutique-demo'
const PRODUCTOS = `/catalogo-premium/${SLUG}/productos`
const CAPTURAS = path.join(__dirname, '__capturas__', 'deportes')
const CAT_ROPA = 13
const CAT_CALZADO = 14

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let adminToken = ''
let originalTemplate = ''
const ids: Record<'reloj' | 'radar' | 'sensor' | 'gorro' | 'sin', number> = { reloj: 0, radar: 0, sensor: 0, gorro: 0, sin: 0 }

async function token(): Promise<string> {
  return new SignJWT({ userId: ADMIN_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
}

function cleanup(): void {
  const list = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Dep%'`).split('\n').filter(Boolean).join(',')
  if (!list) return
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${list})`)
  sql(`DELETE FROM product_variants WHERE product_id IN (${list})`)
  sql(`DELETE FROM product_collections WHERE product_id IN (${list})`)
  sql(`DELETE FROM products WHERE business_id=${BUSINESS_ID} AND id IN (${list})`)
}

const count = (): number => Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Dep%'`))

async function crearProducto(name: string, categoryId: number, description: string | null): Promise<number> {
  const r = await api.post('/api/products', {
    data: {
      name, cost_per_unit_usd: 5, price_per_unit_usd: 10, stock_quantity: 5, category_id: categoryId,
      show_in_catalog: true, catalog_visibility: 'visible', ...(description ? { description } : {}),
    },
  })
  expect(r.status(), await r.text()).toBe(201)
  return ((await r.json()) as { product: { id: number } }).product.id
}

test.beforeAll(async () => {
  cleanup()
  originalTemplate = sql(`SELECT catalog_template FROM businesses WHERE id=${BUSINESS_ID}`)
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BUSINESS_ID}`)
  adminToken = await token()
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${adminToken}` } })
  ids.reloj = await crearProducto('ZZ Dep Reloj', CAT_ROPA, 'Reloj multideporte con GPS.\nBateria de 14 dias.\nDeportes: Running, Natación, Día a día')
  ids.radar = await crearProducto('ZZ Dep Radar', CAT_CALZADO, 'Radar para la bicicleta.\nDEPORTES : ciclismo')
  ids.sensor = await crearProducto('ZZ Dep Sensor', CAT_CALZADO, 'Sensor de cadencia.\nDeportes: Ciclismo, Running')
  ids.gorro = await crearProducto('ZZ Dep Gorro', CAT_ROPA, 'Ideal para natacion en aguas abiertas.')
  ids.sin = await crearProducto('ZZ Dep Sin Descripcion', CAT_ROPA, null)
})

test.afterAll(async () => {
  cleanup()
  sql(`UPDATE businesses SET catalog_template='${originalTemplate}' WHERE id=${BUSINESS_ID}`)
  await api.dispose()
  // Confirmación: cero datos ZZ y plantilla original restaurada.
  expect(count()).toBe(0)
  expect(sql(`SELECT catalog_template FROM businesses WHERE id=${BUSINESS_ID}`)).toBe(originalTemplate)
})

const resultCount = (page: Page) => page.getByText(/^\d+ productos?$/)
const chipsDeporte = (page: Page) => page.getByRole('group', { name: '¿Qué practicas?' })
const chipDeporte = (page: Page, nombre: RegExp) => chipsDeporte(page).getByRole('button', { name: nombre })

/** Abre la ruta reintentando: el servidor compila la primera vez y el catálogo cachea 60 s. */
async function abrir(page: Page, url: string, visible: string): Promise<void> {
  await expect(async () => {
    await page.goto(url)
    await expect(page.getByText(visible, { exact: true }).first()).toBeVisible({ timeout: 8000 })
  }).toPass({ timeout: 90_000 })
}

/** Cantidad que anuncia el chip de la categoría (el mismo número que debe quedar en el listado). */
async function conteoChip(page: Page, nombre: string): Promise<number> {
  const tab = page.getByRole('tablist', { name: 'Filtrar por categoría' }).getByRole('tab', { name: new RegExp(`^${nombre}\\s*\\d+$`) })
  return Number((await tab.innerText()).replace(/\D/g, ''))
}

for (const vp of [{ nombre: '375', width: 375, height: 800 }, { nombre: '1280', width: 1280, height: 900 }]) {
  test(`chips de deporte filtran y actualizan la URL (${vp.nombre}px)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await abrir(page, PRODUCTOS, '¿Qué practicas?')

    // Orden fijo: Running, Ciclismo, Natación, … Día a día; solo los que algún producto declara.
    await expect(chipsDeporte(page).getByRole('button')).toHaveText([/^Running/, /^Ciclismo/, /^Natación/, /^Día a día/])

    await chipDeporte(page, /^Running/).click()
    await expect(page).toHaveURL(/[?&]deporte=running(&|$)/)
    await expect(page.getByText('ZZ Dep Reloj', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('ZZ Dep Sensor', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('ZZ Dep Radar', { exact: true })).toHaveCount(0)
    await expect(resultCount(page)).toHaveText('2 productos')

    // Combina con la categoría: Running ∩ Calzado = solo el sensor.
    if (vp.width < 1024) {
      await page.getByRole('tablist', { name: 'Filtrar por categoría' }).getByRole('tab', { name: /^Calzado/ }).click()
    } else {
      await page.getByRole('complementary', { name: 'Categorías' }).getByRole('button', { name: /^Calzado/ }).click()
    }
    await expect(resultCount(page)).toHaveText('1 producto')
    await expect(page.getByText('ZZ Dep Sensor', { exact: true }).first()).toBeVisible()

    // Sin coincidencias: estado vacío amable con salida.
    await chipDeporte(page, /^Natación/).click()
    await expect(page.getByText(/Aún no tenemos productos para este deporte/)).toBeVisible()
    await page.getByRole('button', { name: 'Ver todo el catálogo' }).click()
    await expect(page).not.toHaveURL(/deporte=/)

    // Quitar el deporte limpia la URL.
    await chipDeporte(page, /^Ciclismo/).click()
    await expect(resultCount(page)).toHaveText('2 productos')
    await page.getByRole('button', { name: 'Quitar deporte' }).click()
    await expect(page).not.toHaveURL(/deporte=/)

    // Tamaño táctil de los chips.
    const box = await chipDeporte(page, /^Running/).boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)

    await page.screenshot({ path: path.join(CAPTURAS, `productos-${vp.nombre}.png`), fullPage: false })
  })
}

test('?deporte= directo llega filtrado (y uno inexistente se ignora)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await abrir(page, `${PRODUCTOS}?deporte=ciclismo`, 'ZZ Dep Radar')
  await expect(resultCount(page)).toHaveText('2 productos')
  await expect(chipDeporte(page, /^Ciclismo/)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('ZZ Dep Reloj', { exact: true })).toHaveCount(0)

  await page.goto(`${PRODUCTOS}?deporte=no-existe`)
  await expect(chipsDeporte(page)).toBeVisible()
  await expect(chipDeporte(page, /^Ciclismo/)).toHaveAttribute('aria-pressed', 'false')
  await expect(page).not.toHaveURL(/deporte=no-existe/)
})

test('en móvil los chips de categoría se ven, filtran y marcan la activa', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await abrir(page, PRODUCTOS, '¿Qué practicas?')
  const tabs = page.getByRole('tablist', { name: 'Filtrar por categoría' })
  await expect(tabs).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Categorías' })).toBeHidden()

  const calzado = await conteoChip(page, 'Calzado')
  await tabs.getByRole('tab', { name: /^Calzado/ }).click()
  await expect(tabs.getByRole('tab', { name: /^Calzado/ })).toHaveAttribute('aria-selected', 'true')
  await expect(tabs.getByRole('tab', { name: /^Todos/ })).toHaveAttribute('aria-selected', 'false')
  await expect(resultCount(page)).toHaveText(`${calzado} producto${calzado === 1 ? '' : 's'}`)

  // El chip queda pegado bajo el header al bajar.
  await page.mouse.wheel(0, 600)
  await expect(tabs).toBeInViewport()

  await tabs.getByRole('tab', { name: /^Todos/ }).click()
  await expect(tabs.getByRole('tab', { name: /^Todos/ })).toHaveAttribute('aria-selected', 'true')
})

test('búsqueda por palabras en cualquier orden, sin tildes, sobre la descripción', async ({ page }) => {
  await abrir(page, PRODUCTOS, '¿Qué practicas?')
  const buscar = page.locator('input[type="search"]:visible').first()

  // "natacion" (sin tilde) solo aparece en la descripción del gorro.
  await buscar.fill('natacion')
  await expect(page.getByText('ZZ Dep Gorro', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('ZZ Dep Radar', { exact: true })).toHaveCount(0)

  // Todas las palabras, en cualquier orden, repartidas entre nombre y descripción.
  await buscar.fill('aguas gorro')
  await expect(resultCount(page)).toHaveText('1 producto')
  await buscar.fill('abiertas dep')
  await expect(page.getByText('ZZ Dep Gorro', { exact: true }).first()).toBeVisible()
  await buscar.fill('gorro bicicleta')
  await expect(resultCount(page)).toHaveText('0 productos')
})

test('la ficha respeta los saltos de línea y muestra los deportes como chips', async ({ page }) => {
  for (const vp of [{ nombre: '375', width: 375, height: 800 }, { nombre: '1280', width: 1280, height: 900 }]) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await abrir(page, `/catalogo-premium/${SLUG}/p/${ids.reloj}`, 'ZZ Dep Reloj')
    const texto = page.getByText('Reloj multideporte con GPS.')
    await expect(texto).toHaveCSS('white-space', 'pre-line')
    await expect(texto).toContainText('Bateria de 14 dias.')
    await expect(page.getByText('Deportes:')).toHaveCount(0)

    const chips = page.getByRole('group', { name: 'Deportes' }).getByRole('link')
    await expect(chips).toHaveText(['Running', 'Natación', 'Día a día'])
    await expect(chips.nth(2)).toHaveAttribute('href', `/catalogo-premium/${SLUG}/productos?deporte=dia-a-dia`)
    await chips.first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(CAPTURAS, `ficha-${vp.nombre}.png`), fullPage: false })
  }

  await page.getByRole('group', { name: 'Deportes' }).getByRole('link', { name: 'Running' }).click()
  await expect(page).toHaveURL(/\/productos\?deporte=running$/)
  await expect(chipDeporte(page, /^Running/)).toHaveAttribute('aria-pressed', 'true')

  // Un producto sin línea "Deportes:" no muestra chips.
  await abrir(page, `/catalogo-premium/${SLUG}/p/${ids.gorro}`, 'Ideal para natacion en aguas abiertas.')
  await expect(page.getByRole('group', { name: 'Deportes' })).toHaveCount(0)
})

test('el formulario de producto acepta 2000 caracteres y la API rechaza más de 5000', async ({ page }) => {
  await page.context().addCookies([{ name: 'activopos_session', value: adminToken, url: BASE }])
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/productos/nuevo')
  const area = page.locator('#np-description')
  await expect(area).toBeVisible({ timeout: 60_000 })
  await area.fill('x'.repeat(2100))
  expect((await area.inputValue()).length).toBe(2000)
  await expect(page.getByText(/Máximo 2000 caracteres \(2000\/2000\)/)).toBeVisible()

  const ok = await api.patch(`/api/products/${ids.sin}`, { data: { description: 'y'.repeat(2000) } })
  expect(ok.status(), await ok.text()).toBeLessThan(300)
  const mal = await api.patch(`/api/products/${ids.sin}`, { data: { description: 'y'.repeat(5001) } })
  expect(mal.status()).toBe(400)
})

test('sin línea "Deportes:" en ningún producto no aparece nada nuevo', async ({ page }) => {
  for (const id of [ids.reloj, ids.radar, ids.sensor]) {
    const r = await api.patch(`/api/products/${id}`, { data: { description: 'Sin deportes declarados.' } })
    expect(r.status(), await r.text()).toBeLessThan(300)
  }
  await expect(async () => {
    await page.goto(PRODUCTOS)
    await expect(page.getByRole('heading', { name: 'Catálogo de Productos' })).toBeVisible({ timeout: 8000 })
    await expect(chipsDeporte(page)).toHaveCount(0)
  }).toPass({ timeout: 90_000 })
})
