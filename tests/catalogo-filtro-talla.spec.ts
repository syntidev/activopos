import { test, expect, type Page } from '@playwright/test'
import { sql } from './alta-helpers'

/**
 * Catálogo premium · filtro de TALLA (calzado EU con US equivalente, ropa XS→3XL). Negocio de prueba 217 (prefijo ZZB):
 * pasa temporalmente a plantilla premium y se restaura; siembra y limpia solo sus filas.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BIZ = 217
const SLUG = 'zzb-pruebas'
const CALZADO = 'ZZB Calzado'
const ROPA = 'ZZB Ropa'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let plantilla = ''

function limpiar(): void {
  sql(`DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE business_id=${BIZ} AND name LIKE 'ZZB T%')`)
  sql(`DELETE FROM products WHERE business_id=${BIZ} AND name LIKE 'ZZB T%'`)
  sql(`DELETE FROM brands WHERE business_id=${BIZ} AND name LIKE 'ZZB Marca%'`)
  sql(`DELETE FROM categories WHERE business_id=${BIZ} AND name IN ('${CALZADO}','${ROPA}')`)
}

const id = (q: string): number => Number(sql(q))

function producto(nombre: string, cat: number, marca: number, variantes: Array<[string, number]>): void {
  sql(`INSERT INTO products (business_id, name, category_id, brand_id, price_per_unit_usd, has_variants, show_in_catalog, catalog_visibility, updated_at)
       VALUES (${BIZ}, '${nombre}', ${cat}, ${marca}, 50, 1, 1, 'visible', NOW(3))`)
  const pid = id(`SELECT id FROM products WHERE business_id=${BIZ} AND name='${nombre}'`)
  const filas = variantes.map(([valor, stock]) => `(${pid}, 'talla', '${valor}', ${stock}, 1)`).join(',')
  sql(`INSERT INTO product_variants (product_id, tipo, valor, stock, is_active) VALUES ${filas}`)
}

test.beforeAll(() => {
  limpiar()
  plantilla = sql(`SELECT catalog_template FROM businesses WHERE id=${BIZ}`)
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BIZ}`)
  sql(`INSERT INTO categories (business_id, name) VALUES (${BIZ}, '${CALZADO}'), (${BIZ}, '${ROPA}')`)
  sql(`INSERT INTO brands (business_id, name, search_term) VALUES (${BIZ}, 'ZZB Marca A', 'zzb a'), (${BIZ}, 'ZZB Marca B', 'zzb b')`)
  const cal = id(`SELECT id FROM categories WHERE business_id=${BIZ} AND name='${CALZADO}'`)
  const rop = id(`SELECT id FROM categories WHERE business_id=${BIZ} AND name='${ROPA}'`)
  const a = id(`SELECT id FROM brands WHERE business_id=${BIZ} AND name='ZZB Marca A'`)
  const b = id(`SELECT id FROM brands WHERE business_id=${BIZ} AND name='ZZB Marca B'`)
  producto('ZZB Tenis Ruta',   cal, a, [['US 9 · EU 42', 2], ['US 9.5 · EU 42.5', 3], ['US 11 · EU 45', 4], ['US 12 · EU 46', 0]])
  producto('ZZB Tenis Trail',  cal, b, [['US 10 · EU 43', 2], ['US 11 · EU 45', 5]])
  producto('ZZB Tenis Pista',  cal, b, [['US 11.5 · EU 45.5', 1]])
  producto('ZZB Tfranela',     rop, a, [['S', 0], ['M', 3], ['L', 2], ['XL', 4], ['2XL', 1]])
  producto('ZZB Tpantaloneta', rop, b, [['XL', 2], ['3XL', 1]])
})

test.afterAll(() => {
  limpiar()
  sql(`UPDATE businesses SET catalog_template='${plantilla}' WHERE id=${BIZ}`)
  expect(id(`SELECT COUNT(*) FROM products WHERE business_id=${BIZ} AND name LIKE 'ZZB T%'`)).toBe(0)
  expect(sql(`SELECT catalog_template FROM businesses WHERE id=${BIZ}`)).toBe(plantilla)
})

const ruta = (cat: string, extra = ''): string => `/catalogo-premium/${SLUG}/productos?categoria=${encodeURIComponent(cat)}${extra}`
const panel = (page: Page) => page.getByRole('dialog', { name: 'Filtros' })
const total = (page: Page) => page.getByText(/^\d+ productos?$/)

async function abrirPanel(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await page.getByRole('button', { name: /^Filtros/ }).click()
  await expect(panel(page)).toBeVisible()
}
const chip = (page: Page, key: string) => panel(page).getByRole('button', { name: new RegExp(`^${key}(\\s|$)`) })
const aplicar = (page: Page) => panel(page).getByRole('button', { name: 'Aplicar filtros' }).click()
const nombres = async (page: Page, patron: RegExp): Promise<string[]> =>
  panel(page).getByRole('button', { pressed: false }).filter({ hasText: patron }).locator('span:first-child').allInnerTexts()

test('calzado: chips EU numéricos con US y conteo, solo con stock; EU 45 no trae 45.5', async ({ page }) => {
  await abrirPanel(page, ruta(CALZADO))
  expect(await nombres(page, /^EU /)).toEqual(['EU 42', 'EU 42.5', 'EU 43', 'EU 45', 'EU 45.5']) // EU 46 sin stock no aparece
  await expect(chip(page, 'EU 45')).toContainText('US 11')
  await expect(chip(page, 'EU 45')).toContainText('2') // Ruta y Trail
  await page.screenshot({ path: '.doc/premium/talla-panel-calzado-390.png' })

  await chip(page, 'EU 45').click()
  await aplicar(page)
  await expect(total(page)).toHaveText('2 productos')
  await expect(page.getByText('ZZB Tenis Pista', { exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(/talla=EU\+45/)
})

test('multi-selección = OR entre tallas, AND con marca; la URL y "atrás" lo reflejan', async ({ page }) => {
  await abrirPanel(page, ruta(CALZADO))
  await chip(page, 'EU 42').click()
  await chip(page, 'EU 43').click()
  await aplicar(page)
  await expect(total(page)).toHaveText('2 productos') // Ruta (42) + Trail (43)
  await expect(page).toHaveURL(/talla=EU\+42&talla=EU\+43/)

  await page.getByRole('button', { name: /^Filtros/ }).click()
  await panel(page).getByLabel('ZZB Marca A').check()
  await aplicar(page)
  await expect(total(page)).toHaveText('1 producto')
  await expect(page.getByText('ZZB Tenis Ruta', { exact: true }).first()).toBeVisible()

  // La marca no vive en la URL (no apila historial): un solo "atrás" deshace la talla.
  await page.goBack()
  await expect(page).not.toHaveURL(/talla=/)
  await expect(total(page)).toHaveText('1 producto') // sigue activa la marca A (no está en la URL)
})

test('URL compartida con ?talla= carga filtrada; escribir limpia la talla y tocar una talla limpia el buscador', async ({ page }) => {
  await page.goto(ruta(CALZADO, '&talla=EU+43'))
  await expect(total(page)).toHaveText('1 producto')
  await page.getByRole('searchbox').first().fill('tenis')
  await expect(page).not.toHaveURL(/talla=/)
  await expect(total(page)).toHaveText('3 productos')

  await abrirPanel(page, ruta(CALZADO, '&buscar=tenis'))
  await chip(page, 'EU 45').click()
  await aplicar(page)
  await expect(page).not.toHaveURL(/buscar=/)
  await expect(page.getByRole('searchbox').first()).toHaveValue('')
})

test('ficha: entrando desde el filtro la talla viene preseleccionada', async ({ page }) => {
  await page.goto(ruta(CALZADO, '&talla=EU+45'))
  await page.getByText('ZZB Tenis Trail', { exact: true }).first().click()
  await expect(page).toHaveURL(/\/p\/\d+\?.*talla=EU\+45/)
  await expect(page.locator('[aria-pressed="true"]').filter({ hasText: 'EU 45' })).toHaveCount(1)
})

test('ropa: XS→3XL en orden, solo con stock y con conteo; "L" no trae XL', async ({ page }) => {
  await abrirPanel(page, ruta(ROPA))
  await expect(chip(page, '3XL')).toBeVisible()
  expect(await nombres(page, /^(XS|S|M|L|XL|2XL|3XL)\d/)).toEqual(['M', 'L', 'XL', '2XL', '3XL']) // S sin stock no aparece
  await expect(chip(page, 'XL')).toContainText('2')
  await page.screenshot({ path: '.doc/premium/talla-panel-ropa-390.png' })

  await chip(page, 'L').click()
  await aplicar(page)
  await expect(total(page)).toHaveText('1 producto') // solo la franela; la pantaloneta tiene XL
})
