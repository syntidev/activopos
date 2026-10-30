import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import path from 'path'
import { envValue, sql } from './alta-helpers'

/**
 * Modal "Gestionar categorías" (Productos) + POST /api/categories/[id]/merge.
 * Negocio 80 (Boutique Demo Pro), datos "ZZ Cat…". Al final no queda ningún ZZ y el orden original se restaura.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BIZ = 80
const ADMIN = 79
const SHOTS = path.join(__dirname, '__capturas__', 'categorias')

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

let token = ''
let api: APIRequestContext
let originalOrder = ''
const ids = { vacia: 0, origen: 0, destino: 0, prod1: 0, prod2: 0, ajena: 0 }

const catId = (name: string): number => Number(sql(`SELECT id FROM categories WHERE business_id=${BIZ} AND name='${name}'`) || 0)

function cleanup(): void {
  const prods = sql(`SELECT id FROM products WHERE business_id=${BIZ} AND name LIKE 'ZZ Cat%'`).split(/\r?\n/).filter(Boolean).join(',')
  if (prods) {
    sql(`DELETE FROM inventory_entries WHERE product_id IN (${prods})`)
    sql(`DELETE FROM product_variants WHERE product_id IN (${prods})`)
    sql(`DELETE FROM product_collections WHERE product_id IN (${prods})`)
    sql(`DELETE FROM products WHERE business_id=${BIZ} AND id IN (${prods})`)
  }
  sql(`DELETE FROM categories WHERE business_id=${BIZ} AND name LIKE 'ZZ Cat%'`)
}

async function openManager(page: Page): Promise<void> {
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
  await page.goto('/productos')
  await page.getByRole('button', { name: 'Gestionar categorías' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByTestId('cat-row').first()).toBeVisible()
}

const row = (page: Page, name: string) => page.getByTestId('cat-row').filter({ hasText: name })

test.beforeAll(async () => {
  token = await new SignJWT({ userId: ADMIN, businessId: BIZ, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${token}` } })
  cleanup()
  originalOrder = sql(`SELECT CONCAT(id,':',sort_order) FROM categories WHERE business_id=${BIZ}`).split(/\r?\n/).join(',')
})

test.afterAll(async () => {
  await api.dispose()
  cleanup()
  for (const pair of originalOrder.split(',').filter(Boolean)) {
    const [id, so] = pair.split(':')
    sql(`UPDATE categories SET sort_order=${so} WHERE id=${id} AND business_id=${BIZ}`)
  }
})

test('crear: la categoría aparece en el modal y en la base', async ({ page }) => {
  await openManager(page)
  await page.getByLabel('Nombre de la nueva categoría').fill('ZZ Cat Ñandú')
  await page.getByRole('button', { name: 'Crear' }).click()
  await expect(row(page, 'ZZ Cat Ñandú')).toBeVisible()
  expect(catId('ZZ Cat Ñandú')).toBeGreaterThan(0)
  for (const n of ['ZZ Cat Vacia', 'ZZ Cat Origen', 'ZZ Cat Destino']) {
    const r = await api.post('/api/categories', { data: { name: n } })
    expect(r.status()).toBe(201)
  }
  ids.vacia = catId('ZZ Cat Vacia'); ids.origen = catId('ZZ Cat Origen'); ids.destino = catId('ZZ Cat Destino')
})

test('buscar: sin tildes ni mayúsculas, varias palabras en AND', async ({ page }) => {
  await openManager(page)
  await page.getByLabel('Buscar categoría').fill('nandu')
  await expect(page.getByTestId('cat-row')).toHaveCount(1)
  await expect(row(page, 'ZZ Cat Ñandú')).toBeVisible()
  await page.getByLabel('Buscar categoría').fill('zz cat origen')
  await expect(page.getByTestId('cat-row')).toHaveCount(1)
  await page.getByLabel('Buscar categoría').fill('zz inexistente')
  await expect(page.getByText('Ninguna categoría coincide')).toBeVisible()
})

test('renombrar + color: muestra el aviso del importador y persiste', async ({ page }) => {
  await openManager(page)
  await page.getByRole('button', { name: 'Renombrar ZZ Cat Ñandú' }).click()
  await expect(page.getByText('El importador de Excel busca la categoría por nombre')).toBeVisible()
  await page.getByLabel('Nuevo nombre de ZZ Cat Ñandú').fill('ZZ Cat Renombrada')
  await page.getByLabel('Color de ZZ Cat Ñandú').fill('#aa3366')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(row(page, 'ZZ Cat Renombrada')).toBeVisible()
  expect(sql(`SELECT UPPER(color) FROM categories WHERE business_id=${BIZ} AND name='ZZ Cat Renombrada'`)).toBe('#AA3366')
})

test('reordenar: subir persiste el orden en la base', async ({ page }) => {
  await openManager(page)
  await expect(page.getByTestId('cat-row').first()).toBeVisible()
  const names = await page.getByTestId('cat-row').locator('span:first-of-type').allTextContents()
  const last = names.length - 1
  await page.getByRole('button', { name: `Subir ${names[last]}` }).click()
  await expect(page.getByText('Orden guardado').first()).toBeVisible()
  const db = sql(`SELECT name FROM categories WHERE business_id=${BIZ} AND active=1 ORDER BY sort_order, name`).split(/\r?\n/)
  expect(db[last - 1]).toBe(names[last])
})

test('eliminar vacía: queda inactiva y desaparece', async ({ page }) => {
  await openManager(page)
  await page.getByRole('button', { name: 'Eliminar ZZ Cat Vacia' }).click()
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click()
  await expect(row(page, 'ZZ Cat Vacia')).toHaveCount(0)
  expect(sql(`SELECT active FROM categories WHERE id=${ids.vacia} AND business_id=${BIZ}`)).toBe('0')
})

test('fusionar con productos: se mueven en la base y el origen queda inactivo', async ({ page }) => {
  for (const [k, n] of [['prod1', 'ZZ Cat P1'], ['prod2', 'ZZ Cat P2']] as const) {
    const r = await api.post('/api/products', { data: { name: n, cost_per_unit_usd: 1, price_per_unit_usd: 2, category_id: ids.origen } })
    expect(r.status(), JSON.stringify(await r.json().catch(() => ({})))).toBe(201)
    ids[k] = (await r.json()).product.id as number
  }
  await openManager(page)
  await page.screenshot({ path: path.join(SHOTS, 'modal-lista.png') })
  await page.getByRole('button', { name: 'Eliminar ZZ Cat Origen' }).click()
  await expect(page.getByText('Mover sus 2 productos a…')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mover y eliminar' })).toBeDisabled()
  await page.getByRole('combobox').selectOption(String(ids.destino))
  await page.screenshot({ path: path.join(SHOTS, 'modal-fusion.png') })
  await page.getByRole('button', { name: 'Mover y eliminar' }).click()
  await expect(row(page, 'ZZ Cat Origen')).toHaveCount(0)
  expect(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BIZ} AND category_id=${ids.destino} AND id IN (${ids.prod1},${ids.prod2})`)).toBe('2')
  expect(sql(`SELECT COUNT(*) FROM products WHERE category_id=${ids.origen}`)).toBe('0')
  expect(sql(`SELECT active FROM categories WHERE id=${ids.origen}`)).toBe('0')
})

test('merge: aislamiento entre negocios y validaciones', async () => {
  ids.ajena = Number(sql(`SELECT id FROM categories WHERE business_id<>${BIZ} AND active=1 LIMIT 1`))
  const nuevo = await api.post('/api/categories', { data: { name: 'ZZ Cat Aislada' } })
  const mia = (await nuevo.json()).category.id as number
  const before = sql(`SELECT COUNT(*) FROM products WHERE category_id=${ids.ajena}`)

  expect((await api.post(`/api/categories/${mia}/merge`, { data: { target_id: ids.ajena } })).status()).toBe(404)
  expect((await api.post(`/api/categories/${ids.ajena}/merge`, { data: { target_id: mia } })).status()).toBe(404)
  expect((await api.post(`/api/categories/${mia}/merge`, { data: { target_id: mia } })).status()).toBe(400)
  expect((await api.post(`/api/categories/${mia}/merge`, { data: {} })).status()).toBe(400)
  expect((await api.post(`/api/categories/${mia}/merge`, { data: { target_id: ids.origen } })).status()).toBe(404) // destino inactivo

  expect(sql(`SELECT COUNT(*) FROM products WHERE category_id=${ids.ajena}`)).toBe(before)
  expect(sql(`SELECT active FROM categories WHERE id=${ids.ajena}`)).toBe('1')
  const anon = await pwRequest.newContext({ baseURL: BASE })
  expect((await anon.post(`/api/categories/${mia}/merge`, { data: { target_id: ids.destino }, maxRedirects: 0 })).status()).not.toBe(200)
  await anon.dispose()
})

test('capturas 1280 y 375', async ({ page }) => {
  for (const [w, h, file] of [[1280, 800, 'modal-1280.png'], [375, 740, 'modal-375.png']] as const) {
    await page.setViewportSize({ width: w, height: h })
    await openManager(page)
    await page.screenshot({ path: path.join(SHOTS, file) })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `overflow horizontal a ${w}px`).toBe(false)
  }
})

test('cleanup: conteo ZZ en negocio 80 es 0', async () => {
  cleanup()
  expect(sql(`SELECT (SELECT COUNT(*) FROM categories WHERE business_id=${BIZ} AND name LIKE 'ZZ%') + (SELECT COUNT(*) FROM products WHERE business_id=${BIZ} AND name LIKE 'ZZ%')`)).toBe('0')
})
