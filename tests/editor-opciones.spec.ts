import { test, expect, request as pwRequest, type APIRequestContext, type Locator } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Editor de grupos de opciones del producto (admin del negocio): API (PUT con reemplazo completo, ids conservados, validaciones,
 * permisos) y pantalla (crear, editar, ordenar, borrar con ConfirmDialog, toques de 44 px). Negocio propio (E2E_BUSINESS_ID),
 * puerto 3001, productos ZZA que se borran al final.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const OWN = ownBusiness()
const BID = OWN.businessId
const TAG = String(Date.now()).slice(-6)

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 150_000 })

let api: APIRequestContext
let pid = 0
let pid2 = 0

const tokenFor = (userId: number, role: string) => new SignJWT({ userId, businessId: BID, role, name: 'ZZA Prueba' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
  .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

const ctxFor = async (userId: number, role: string): Promise<APIRequestContext> =>
  pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await tokenFor(userId, role)}` } })

interface Opt { id?: number; name: string; price_extra_usd: number; is_active?: boolean }
interface Grp { id?: number; name: string; required: boolean; multiple: boolean; max_select: number | null; is_active?: boolean; options: Opt[] }
const g = (name: string, options: Opt[], extra: Partial<Grp> = {}): Grp => ({ name, required: false, multiple: false, max_select: null, options, ...extra })

const put = (productId: number, groups: unknown[]) => api.put(`/api/products/${productId}/options`, { data: { groups } })
const dbGroups = (productId: number): string => sql(`SELECT IFNULL(GROUP_CONCAT(CONCAT(name,':',required,multiple,IFNULL(max_select,'-'),':',sort_order) ORDER BY sort_order SEPARATOR ' | '),'') FROM product_option_groups WHERE product_id=${productId}`)
const dbOptions = (productId: number): string => sql(`SELECT IFNULL(GROUP_CONCAT(CONCAT(g.name,'>',o.name,'=',o.price_extra_usd) ORDER BY g.sort_order, o.sort_order SEPARATOR ' | '),'') FROM product_options o JOIN product_option_groups g ON g.id=o.group_id WHERE g.product_id=${productId}`)

function cleanup(): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZA Opciones%'`).split('\n').filter(Boolean).join(',')
  if (!ids) return
  sql(`DELETE FROM product_options WHERE group_id IN (SELECT id FROM product_option_groups WHERE product_id IN (${ids}))`)
  sql(`DELETE FROM product_option_groups WHERE product_id IN (${ids})`)
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND id IN (${ids})`)
  sql(`DELETE FROM activity_logs WHERE business_id=${BID} AND action='product_options_updated' AND model_id IN (${ids})`)
}

test.beforeAll(async () => {
  cleanup()
  api = await ctxFor(OWN.adminId, 'admin')
  const mk = async (n: string): Promise<number> => {
    const r = await api.post('/api/products', { data: { name: `ZZA Opciones ${n} ${TAG}`, cost_per_unit_usd: 2, price_per_unit_usd: 10, is_fixed_price: true, stock_quantity: 10 } })
    expect(r.status(), await r.text()).toBe(201)
    return ((await r.json()) as { product: { id: number } }).product.id
  }
  pid = await mk('A')
  pid2 = await mk('B')
})

test.afterAll(async () => {
  await api?.dispose()
  cleanup()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BID} AND name LIKE 'ZZA Opciones%'`))).toBe(0)
})

test('API: crear grupos y opciones; el orden del arreglo es el orden guardado; precios a 2 decimales', async () => {
  expect(((await (await api.get(`/api/products/${pid}/options`)).json()) as { groups: unknown[] }).groups).toEqual([])
  const r = await put(pid, [
    g('Tocineta', [{ name: 'Pavo', price_extra_usd: 0 }, { name: 'Cochino', price_extra_usd: 1.5 }], { required: true }),
    g('Extras', [{ name: 'Queso', price_extra_usd: 1 }, { name: 'Huevo', price_extra_usd: 0.755 }, { name: 'Aguacate', price_extra_usd: 2 }], { multiple: true, max_select: 2 }),
  ])
  expect(r.status(), await r.text()).toBe(200)
  expect(dbGroups(pid)).toBe('Tocineta:10-:0 | Extras:012:1')
  expect(dbOptions(pid)).toBe('Tocineta>Pavo=0.00 | Tocineta>Cochino=1.50 | Extras>Queso=1.00 | Extras>Huevo=0.76 | Extras>Aguacate=2.00')
})

test('API: reemplazo completo conserva los ids de lo que sigue, borra lo que sale y reordena', async () => {
  const before = ((await (await api.get(`/api/products/${pid}/options`)).json()) as { groups: Grp[] }).groups
  const [toc, ext] = before
  const r = await put(pid, [
    // Extras sube al primer lugar, pierde Aguacate, renombra Huevo y suma Tomate; Tocineta baja
    { ...ext, options: [ext.options[0], { ...ext.options[1], name: 'Huevo frito' }, { name: 'Tomate', price_extra_usd: 0.5 }] },
    toc,
  ])
  expect(r.status(), await r.text()).toBe(200)
  const after = ((await r.json()) as { groups: Grp[] }).groups
  expect(after.map(x => x.id)).toEqual([ext.id, toc.id])                          // mismos ids, orden nuevo
  expect(after[0].options.map(o => o.id).slice(0, 2)).toEqual([ext.options[0].id, ext.options[1].id])
  expect(after[0].options[2].id).not.toBe(ext.options[2].id)                       // Tomate es una opción nueva
  expect(dbOptions(pid)).toBe('Extras>Queso=1.00 | Extras>Huevo frito=0.76 | Extras>Tomate=0.50 | Tocineta>Pavo=0.00 | Tocineta>Cochino=1.50')
  expect(sql(`SELECT COUNT(*) FROM product_options WHERE id=${ext.options[2].id}`)).toBe('0') // Aguacate se borró

  // quitar un grupo entero arrastra sus opciones
  expect((await put(pid, [after[0]])).status()).toBe(200)
  expect(dbGroups(pid)).toContain('Extras')
  expect(sql(`SELECT COUNT(*) FROM product_option_groups WHERE id=${toc.id}`)).toBe('0')
  expect(sql(`SELECT COUNT(*) FROM product_options WHERE group_id=${toc.id}`)).toBe('0')
  // y vaciar deja el producto sin grupos
  expect((await put(pid, [])).status()).toBe(200)
  expect(sql(`SELECT COUNT(*) FROM product_option_groups WHERE product_id=${pid}`)).toBe('0')
})

test('API: zod estricto y reglas de negocio dan 400; ids ajenos 422; otro negocio 404', async () => {
  const bad = async (groups: unknown[], extra: Record<string, unknown> = {}) => (await api.put(`/api/products/${pid}/options`, { data: { groups, ...extra } })).status()
  const ok = [{ name: 'Pavo', price_extra_usd: 0 }, { name: 'Cochino', price_extra_usd: 0 }]
  expect(await bad([g('', ok)])).toBe(400)                                                    // nombre vacío
  expect(await bad([g('X', [])])).toBe(400)                                                   // sin opciones
  expect(await bad([g('X', [{ name: 'A', price_extra_usd: 0 }, { name: 'a', price_extra_usd: 1 }])])).toBe(400) // opciones repetidas
  expect(await bad([g('X', ok), g('x', ok)])).toBe(400)                                       // grupos repetidos
  expect(await bad([g('X', ok, { max_select: 1 })])).toBe(400)                                // tope en elección única
  expect(await bad([g('X', ok, { multiple: true, max_select: 5 })])).toBe(400)                // tope mayor que las opciones
  expect(await bad([g('X', [{ name: 'A', price_extra_usd: -1 }])])).toBe(400)                 // extra negativo
  expect(await bad([g('X', [{ name: 'A'.repeat(61), price_extra_usd: 0 }])])).toBe(400)       // nombre largo
  expect(await bad([{ ...g('X', ok), business_id: 1 }])).toBe(400)                            // clave desconocida
  expect(await bad([], { business_id: 1 })).toBe(400)                                         // clave desconocida arriba
  expect(await bad(Array.from({ length: 21 }, (_, i) => g(`G${i}`, ok)))).toBe(400)          // demasiados grupos
  expect((await api.put(`/api/products/${pid}/options`, { data: 'no-json' })).status()).toBeGreaterThanOrEqual(400)
  expect(sql(`SELECT COUNT(*) FROM product_option_groups WHERE product_id=${pid}`)).toBe('0') // ninguna validación dejó basura

  // ids ajenos al producto: grupo de otro producto y opción de otro grupo
  const other = await put(pid2, [g('Otro', ok), g('Segundo', [{ name: 'Z', price_extra_usd: 0 }])])
  expect(other.status()).toBe(200)
  const og = ((await other.json()) as { groups: Grp[] }).groups
  expect((await put(pid, [{ ...g('X', ok), id: og[0].id }])).status()).toBe(422)
  expect((await put(pid2, [{ ...g('Otro', [{ ...ok[0], id: og[1].options[0].id }, ok[1]]), id: og[0].id }, og[1]])).status()).toBe(422)
  expect(dbGroups(pid)).toBe('')

  // otro negocio: el producto no existe para este tenant
  const foreign = Number(sql(`SELECT id FROM products WHERE business_id<>${BID} ORDER BY id LIMIT 1`))
  expect((await put(foreign, [])).status()).toBe(404)
  expect((await api.get(`/api/products/${foreign}/options`)).status()).toBe(404)
  expect((await api.get('/api/products/abc/options')).status()).toBe(400)
})

test('API: el cajero recibe 403 y sin sesión no entra', async () => {
  const cashier = await ctxFor(OWN.cashierId, 'cashier')
  expect((await cashier.get(`/api/products/${pid}/options`)).status()).toBe(403)
  expect((await cashier.put(`/api/products/${pid}/options`, { data: { groups: [] } })).status()).toBe(403)
  await cashier.dispose()
  const anon = await pwRequest.newContext({ baseURL: BASE })
  expect([307, 401]).toContain((await anon.get(`/api/products/${pid}/options`, { maxRedirects: 0 })).status())
  expect([307, 401]).toContain((await anon.put(`/api/products/${pid}/options`, { data: { groups: [] }, maxRedirects: 0 })).status())
  await anon.dispose()
})

async function expectTouch(loc: Locator): Promise<void> {
  const boxes = await loc.evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { h: r.height, label: e.getAttribute('aria-label') ?? e.textContent ?? '' } }))
  for (const b of boxes) expect(b.h, `alto de «${b.label.trim()}»`).toBeGreaterThanOrEqual(43.5)
}

test('pantalla: crear, editar, ordenar y borrar (con ConfirmDialog) en /productos/[id]/editar', async ({ page }) => {
  await page.context().addCookies([{ name: 'activopos_session', value: await tokenFor(OWN.adminId, 'admin'), url: BASE }])
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/productos/${pid}/editar`)
  const ed = page.getByTestId('options-editor')
  await expect(ed).toBeVisible({ timeout: 90_000 })
  await expect(ed).toContainText('aún no tiene grupos de opciones')

  // crear grupo 1: Tocineta, obligatorio, Pavo / Cochino +1.5
  await ed.getByTestId('option-add-group').click()
  const g1 = ed.getByTestId('option-group').nth(0)
  await g1.getByPlaceholder('Nombre del grupo (ej. Tocineta)').fill('Tocineta')
  await g1.getByLabel('Obligatorio').check()
  await g1.getByPlaceholder('Opción (ej. Pavo)').fill('Pavo')
  await g1.getByRole('button', { name: 'Agregar opción' }).click()
  const g1rows = g1.getByTestId('option-row')
  await g1rows.nth(1).getByPlaceholder('Opción (ej. Pavo)').fill('Cochino')
  await g1rows.nth(1).getByPlaceholder('Extra $ 0').fill('1.5')

  // crear grupo 2: Extras, varias con tope 2
  await ed.getByTestId('option-add-group').click()
  const g2 = ed.getByTestId('option-group').nth(1)
  await g2.getByPlaceholder('Nombre del grupo (ej. Tocineta)').fill('Extras')
  await g2.getByLabel('Permitir varias').check()
  await g2.getByPlaceholder('sin tope').fill('2')
  await g2.getByPlaceholder('Opción (ej. Pavo)').fill('Queso')
  await g2.getByPlaceholder('Extra $ 0').fill('1')
  await g2.getByRole('button', { name: 'Agregar opción' }).click()
  await g2.getByTestId('option-row').nth(1).getByPlaceholder('Opción (ej. Pavo)').fill('Huevo')

  // validación local: sin nombre no guarda
  await g1rows.nth(1).getByPlaceholder('Opción (ej. Pavo)').fill('')
  await ed.getByTestId('option-save').click()
  await expect(ed.getByRole('alert')).toContainText('opción sin nombre')
  await g1rows.nth(1).getByPlaceholder('Opción (ej. Pavo)').fill('Cochino')

  await page.screenshot({ path: 'tests/__capturas__/zza-opciones-editor-1280.png', fullPage: true })
  await ed.getByTestId('option-save').click()
  await expect(ed.getByRole('status')).toContainText('Opciones guardadas')
  expect(dbGroups(pid)).toBe('Tocineta:10-:0 | Extras:012:1')
  expect(dbOptions(pid)).toBe('Tocineta>Pavo=0.00 | Tocineta>Cochino=1.50 | Extras>Queso=1.00 | Extras>Huevo=0.00')

  // ordenar: Extras sube y Huevo sube dentro de su grupo
  await ed.getByRole('button', { name: 'Subir grupo Extras' }).click()
  await ed.getByRole('button', { name: 'Subir opción Huevo' }).click()
  await ed.getByTestId('option-save').click()
  await expect(ed.getByRole('status')).toContainText('Opciones guardadas')
  expect(dbGroups(pid)).toBe('Extras:012:0 | Tocineta:10-:1')
  expect(dbOptions(pid)).toBe('Extras>Huevo=0.00 | Extras>Queso=1.00 | Tocineta>Pavo=0.00 | Tocineta>Cochino=1.50')

  // persiste al recargar
  await page.reload()
  await expect(page.getByTestId('options-editor').getByTestId('option-group')).toHaveCount(2, { timeout: 90_000 })

  // borrar una opción: Cancelar la deja; Confirmar la quita (se aplica al guardar)
  const ed2 = page.getByTestId('options-editor')
  await ed2.getByRole('button', { name: 'Eliminar opción Cochino' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Cochino')
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused()
  await page.screenshot({ path: 'tests/__capturas__/zza-opciones-confirmar-1280.png' })
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(ed2.getByRole('button', { name: 'Eliminar opción Cochino' })).toBeVisible()
  await ed2.getByRole('button', { name: 'Eliminar opción Cochino' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar opción' }).click()
  await expect(ed2.getByRole('button', { name: 'Eliminar opción Cochino' })).toHaveCount(0)
  expect(dbOptions(pid)).toContain('Tocineta>Cochino=1.50') // aún no se guardó

  // borrar un grupo: confirmación con el nombre y el conteo; Esc cancela; luego confirmar y guardar
  await ed2.getByRole('button', { name: 'Eliminar grupo Extras' }).click()
  const d2 = page.getByRole('alertdialog')
  await expect(d2).toContainText('Extras')
  await expect(d2).toContainText('2 opciones')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(ed2.getByTestId('option-group')).toHaveCount(2)
  await ed2.getByRole('button', { name: 'Eliminar grupo Extras' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar grupo' }).click()
  await expect(ed2.getByTestId('option-group')).toHaveCount(1)
  await ed2.getByTestId('option-save').click()
  await expect(ed2.getByRole('status')).toContainText('Opciones guardadas')
  expect(dbGroups(pid)).toBe('Tocineta:10-:0')
  expect(dbOptions(pid)).toBe('Tocineta>Pavo=0.00')
})

test('toques de 44 px y sin desborde a 375 px', async ({ page }) => {
  await put(pid, [g('Tocineta', [{ name: 'Pavo', price_extra_usd: 0 }, { name: 'Cochino', price_extra_usd: 1.5 }], { required: true }), g('Extras', [{ name: 'Queso', price_extra_usd: 1 }, { name: 'Huevo', price_extra_usd: 0 }], { multiple: true, max_select: 2 })])
  await page.context().addCookies([{ name: 'activopos_session', value: await tokenFor(OWN.adminId, 'admin'), url: BASE }])
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/productos/${pid}/editar`)
    const ed = page.getByTestId('options-editor')
    await expect(ed.getByTestId('option-group')).toHaveCount(2, { timeout: 90_000 })
    await expectTouch(ed.locator('button'))
    await expectTouch(ed.locator('input[type="text"], input:not([type])'))
    await expectTouch(ed.locator('label'))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await ed.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `tests/__capturas__/zza-opciones-editor-${width}.png`, fullPage: true })
  }
})
