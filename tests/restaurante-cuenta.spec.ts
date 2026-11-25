import path from 'path'
import { expect, test, type Page } from '@playwright/test'
import { BASE, CAPTURAS, businessId, ensureBusiness, ensureUser, login, seedCarta, sql, type CartaSeed } from './helpers/restaurante-kds'

/**
 * Restaurante R2 — cuenta de mesa del mesonero.
 * Solo activopos_kds. A = negocio con el módulo y datos; B = otro negocio con el módulo (aislamiento).
 */

test.use({ storageState: { cookies: [], origins: [] }, baseURL: BASE })
test.describe.configure({ mode: 'serial' })

const SHOTS = path.join(CAPTURAS, 'r2')
let A = 0, B = 0
let admin = 0, cashier = 0, waiter = 0, waiter2 = 0, adminB = 0
let carta: CartaSeed
let table4 = 0, table5 = 0
let account5 = 0

interface Item { id: number; product_name: string; quantity: number; price_per_unit_usd: number; subtotal_usd: number; kds_status: string; modifiers: Array<{ group: string; option: string; price_usd: number }> }
interface Account { id: number; status: string; table_label: string; waiter_id: number; total_usd: number; total_bs: number; rate_used: number; items: Item[] }

const post = (page: Page, url: string, data: Record<string, unknown>) => page.request.post(`${BASE}${url}`, { data })
const get = (page: Page, url: string) => page.request.get(`${BASE}${url}`)
const getNoRedirect = (page: Page, url: string) => page.request.get(`${BASE}${url}`, { maxRedirects: 0 })
const noOverflow = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

async function addItem(page: Page, accountId: number, body: Record<string, unknown>) {
  return post(page, `/api/restaurante/cuentas/${accountId}/items`, body)
}

test.beforeAll(() => {
  A = ensureBusiness('zzkds-a', true)
  B = ensureBusiness('zzkds-b', true)
  admin = ensureUser(A, 'admin', 'Admin Salon')
  cashier = ensureUser(A, 'cashier', 'Caja Salon')
  waiter = ensureUser(A, 'waiter', 'Maria P')
  waiter2 = ensureUser(A, 'waiter', 'Luis R')
  adminB = ensureUser(B, 'admin', 'Admin B')
  carta = seedCarta(A)
})

test('0 · preparación: área, mesas 4 y 5 y el modificador "Extra queso +$1.00"', async ({ page, context }) => {
  await login(context, A, 'admin', admin)
  const area = ((await (await post(page, '/api/restaurante/areas', { name: 'Salón' })).json()) as { area: { id: number } }).area
  const tables = ((await (await post(page, '/api/restaurante/mesas', { area_id: area.id, from: 4, to: 5, capacity: 4 })).json()) as { tables: Array<{ id: number; label: string }> }).tables
  table4 = tables.find(t => t.label === '4')!.id
  table5 = tables.find(t => t.label === '5')!.id
  expect((await post(page, '/api/restaurante/mesas', { area_id: area.id, label: '7', capacity: 2 })).status()).toBe(201) // mesa libre para el test 8
  const mod = await post(page, '/api/restaurante/modificadores', { name: 'Extra queso', price_usd: 1, product_id: carta.pasta, group_name: 'Extras' })
  expect(mod.status()).toBe(201)
})

test('1 · abrir mesa 5 con 3 comensales: queda ocupada; la segunda apertura da 409 con la cuenta existente', async ({ page, context }) => {
  await login(context, A, 'cashier', cashier)
  const res = await post(page, '/api/restaurante/cuentas', { table_id: table5, guests: 3, waiter_id: waiter, client_name: 'Juan' })
  expect(res.status()).toBe(201)
  const acc = ((await res.json()) as { account: Account }).account
  account5 = acc.id
  expect(acc.waiter_id).toBe(waiter)

  const mesas = ((await (await get(page, '/api/restaurante/mesas')).json()) as { tables: Array<{ label: string; status: string; account_id: number | null }> }).tables
  const m5 = mesas.find(t => t.label === '5')!
  expect(m5.status).toBe('ocupada')
  expect(m5.account_id).toBe(account5)
  expect(mesas.find(t => t.label === '4')!.status).toBe('libre')
  expect(sql(`SELECT guests, origin, account_status FROM orders WHERE id=${account5}`)).toBe('3\ttable\topen')

  // Segunda apertura (otro dispositivo): 409 con el id de la existente, sin duplicar.
  const dup = await post(page, '/api/restaurante/cuentas', { table_id: table5, guests: 2 })
  expect(dup.status()).toBe(409)
  const dupBody = (await dup.json()) as { code: string; account_id: number }
  expect(dupBody.code).toBe('TABLE_OCCUPIED')
  expect(dupBody.account_id).toBe(account5)
  expect(Number(sql(`SELECT COUNT(*) FROM orders WHERE business_id=${A} AND table_id=${table5} AND account_status IN ('open','bill_requested')`))).toBe(1)

  // Mesa por limpiar: pide confirmación; con ella abre y quita la marca.
  await page.request.patch(`${BASE}/api/restaurante/mesas/${table4}`, { data: { cleaning_pending: true } })
  const sucia = await post(page, '/api/restaurante/cuentas', { table_id: table4, guests: 2 })
  expect(sucia.status()).toBe(409)
  expect(((await sucia.json()) as { code: string }).code).toBe('NEEDS_CLEAN_CONFIRM')
  const limpia = await post(page, '/api/restaurante/cuentas', { table_id: table4, guests: 2, confirm_clean: true })
  expect(limpia.status()).toBe(201)
  expect(sql(`SELECT cleaning_pending FROM dining_tables WHERE id=${table4}`)).toBe('0')
  // Comensales: máximo capacidad + 4.
  expect((await post(page, '/api/restaurante/cuentas', { table_id: table4, guests: 99 })).status()).toBe(400)
})

test('2 · 2 × pasta con "Extra queso +$1.00": la línea trae base + 1.00 calculado en servidor y un precio falso se ignora', async ({ page, context }) => {
  await login(context, A, 'waiter', waiter)
  const mods = ((await (await get(page, `/api/restaurante/productos?q=pasta`)).json()) as { products: Array<{ id: number; price_usd: number; modifiers: Array<{ id: number; name: string }> }> }).products
  const pasta = mods.find(p => p.id === carta.pasta)!
  expect(pasta.price_usd).toBe(14)
  const extra = pasta.modifiers.find(m => m.name === 'Extra queso')!

  const res = await addItem(page, account5, {
    product_id: carta.pasta, quantity: 2, modifier_ids: [extra.id], note: 'sin picante', course: 2,
    // Todo lo que sigue lo manda un cliente tramposo: el servidor lo descarta.
    price_per_unit_usd: 0.01, subtotal_usd: 0.01, total_usd: 0.01,
  })
  expect(res.status()).toBe(201)
  const acc = ((await res.json()) as { account: Account }).account
  const line = acc.items.find(i => i.product_name === 'ZZ Pasta carbonara')!
  expect(line.price_per_unit_usd).toBe(15)
  expect(line.subtotal_usd).toBe(30)
  expect(line.kds_status).toBe('draft')
  expect(line.modifiers).toEqual([{ group: 'Extras', option: 'Extra queso', price_usd: 1 }])
  expect(acc.total_usd).toBe(30)
  expect(acc.total_bs).toBeCloseTo(30 * acc.rate_used, 2)
  expect(sql(`SELECT note, course FROM order_items WHERE id=${line.id}`)).toBe('sin picante\t2')

  // Un modificador que no aplica (o de otro negocio) y un producto ajeno se rechazan.
  expect((await addItem(page, account5, { product_id: carta.cerveza, quantity: 1, modifier_ids: [extra.id] })).status()).toBe(422)
  expect((await addItem(page, account5, { product_id: 999999, quantity: 1 })).status()).toBe(404)
  // Grupo obligatorio sin elegir: no deja agregar.
  await login(context, A, 'admin', admin)
  const req = await post(page, '/api/restaurante/modificadores', { name: 'Medio', group_name: 'Término', price_usd: 0, required: true, product_id: carta.cerveza })
  expect(req.status()).toBe(201)
  await post(page, '/api/restaurante/modificadores', { name: 'Bien cocido', group_name: 'Término', price_usd: 0, required: true, product_id: carta.cerveza })
  const sinElegir = await addItem(page, account5, { product_id: carta.cerveza, quantity: 1 })
  expect(sinElegir.status()).toBe(422)
  expect(((await sinElegir.json()) as { error: string }).error).toContain('Término')
})

test('3 · el producto por peso acepta decimales; el de unidad los rechaza', async ({ page, context }) => {
  await login(context, A, 'waiter', waiter)
  const kg = await addItem(page, account5, { product_id: carta.queso, quantity: 0.5, course: 1 })
  expect(kg.status()).toBe(201)
  const acc = ((await kg.json()) as { account: Account }).account
  const queso = acc.items.find(i => i.product_name === 'ZZ Queso por kg')!
  expect(queso.quantity).toBe(0.5)
  expect(queso.subtotal_usd).toBe(10)
  expect(acc.total_usd).toBe(40)

  const decimalEnUnidad = await addItem(page, account5, { product_id: carta.pasta, quantity: 1.5 })
  expect(decimalEnUnidad.status()).toBe(422)
  expect(((await decimalEnUnidad.json()) as { error: string }).error).toContain('entero')
  expect((await addItem(page, account5, { product_id: carta.queso, quantity: 0.12345 })).status()).toBe(422)
  expect((await addItem(page, account5, { product_id: carta.queso, quantity: 0 })).status()).toBe(400)
  expect(((await (await get(page, `/api/restaurante/cuentas/${account5}`)).json()) as { account: Account }).account.total_usd).toBe(40)
})

test('4 · el mesonero: lista blanca, sin costos, no cobra y abre siempre a su nombre', async ({ page, context }) => {
  await login(context, A, 'waiter', waiter)
  for (const url of ['/pos', '/finanzas', '/pedidos', '/caja']) {
    const r = await getNoRedirect(page, url)
    expect(r.status(), url).toBe(307)
    expect(r.headers().location).toContain('/restaurante/mesas')
  }
  for (const url of ['/api/sales', '/api/products', '/api/orders', '/api/finanzas/resumen']) {
    expect((await get(page, url)).status(), url).toBe(403)
  }
  expect((await page.request.patch(`${BASE}/api/sales/1/pay`, { data: {} })).status()).toBe(403)
  expect((await page.request.post(`${BASE}/api/orders/1/cobrar`, { data: {} })).status()).toBe(403)

  // La carta del mesonero no trae costos, márgenes ni proveedores.
  const carte = await (await get(page, '/api/restaurante/productos')).text()
  expect(carte).not.toMatch(/cost|margin|margen|supplier|proveedor|wholesale/i)

  // No configura nada.
  expect((await post(page, '/api/restaurante/areas', { name: 'X' })).status()).toBe(403)
  expect((await post(page, '/api/restaurante/modificadores', { name: 'X', price_usd: 0 })).status()).toBe(403)
  expect((await post(page, '/api/restaurante/activacion', { enabled: false })).status()).toBe(403)

  // Abre a su nombre aunque el cuerpo pida a otro mesonero.
  const area = ((await (await get(page, '/api/restaurante/areas')).json()) as { areas: Array<{ id: number }> }).areas[0]
  await login(context, A, 'admin', admin)
  const t6 = ((await (await post(page, '/api/restaurante/mesas', { area_id: area.id, label: '6', capacity: 2 })).json()) as { tables: Array<{ id: number }> }).tables[0]
  await login(context, A, 'waiter', waiter)
  const res = await post(page, '/api/restaurante/cuentas', { table_id: t6.id, guests: 2, waiter_id: waiter2 })
  expect(res.status()).toBe(201)
  expect(((await res.json()) as { account: Account }).account.waiter_id).toBe(waiter)
})

test('5 · quitar un borrador recalcula el total; las mesas con cuenta no se eliminan ni el módulo se apaga', async ({ page, context }) => {
  await login(context, A, 'waiter', waiter)
  const acc = ((await (await get(page, `/api/restaurante/cuentas/${account5}`)).json()) as { account: Account }).account
  const queso = acc.items.find(i => i.product_name === 'ZZ Queso por kg')!
  const del = await page.request.delete(`${BASE}/api/restaurante/cuentas/${account5}/items/${queso.id}`, { data: { reason: 'Cliente cambió' } })
  expect(del.status()).toBe(200)
  const after = ((await del.json()) as { account: Account }).account
  expect(after.items.find(i => i.id === queso.id)!.kds_status).toBe('void')
  expect(after.total_usd).toBe(30)
  expect(sql(`SELECT type FROM table_events WHERE order_id=${account5} AND type='void_item'`)).toBe('void_item')
  expect((await page.request.delete(`${BASE}/api/restaurante/cuentas/${account5}/items/${queso.id}`, { data: {} })).status()).toBe(422) // ya anulado

  await login(context, A, 'admin', admin)
  const eliminar = await page.request.delete(`${BASE}/api/restaurante/mesas/${table5}`)
  expect(eliminar.status()).toBe(409)
  expect(((await eliminar.json()) as { code: string }).code).toBe('TABLE_HAS_OPEN_ACCOUNT')
  expect((await page.request.patch(`${BASE}/api/restaurante/mesas/${table5}`, { data: { active: false } })).status()).toBe(409)
  const apagar = await post(page, '/api/restaurante/activacion', { enabled: false })
  expect(apagar.status()).toBe(409)
  expect(((await apagar.json()) as { code: string }).code).toBe('OPEN_ACCOUNTS')
  expect(sql(`SELECT restaurante_enabled FROM businesses WHERE id=${A}`)).toBe('1')
})

test('6 · búsqueda híbrida de cuentas ("juan 5") y aislamiento entre negocios', async ({ page, context }) => {
  await login(context, A, 'cashier', cashier)
  const found = ((await (await get(page, `/api/restaurante/cuentas?q=${encodeURIComponent('juan 5')}`)).json()) as { cuentas: Array<{ id: number }> }).cuentas
  expect(found.map(c => c.id)).toEqual([account5])
  // Las cuentas de mesa no ensucian el tablero de Pedidos ni el KDS actual.
  const pedidos = ((await (await get(page, '/api/orders?limit=100')).json()) as { orders: Array<{ id: number }> }).orders
  expect(pedidos.map(o => o.id)).not.toContain(account5)
  const kds = ((await (await get(page, '/api/orders?send_to_kds=true&limit=100')).json()) as { orders: Array<{ id: number }> }).orders
  expect(kds.map(o => o.id)).not.toContain(account5)
  const porProducto = ((await (await get(page, `/api/restaurante/cuentas?q=${encodeURIComponent('carbonara maria')}`)).json()) as { cuentas: Array<{ id: number }> }).cuentas
  expect(porProducto.map(c => c.id)).toContain(account5)
  expect(((await (await get(page, `/api/restaurante/cuentas?q=${encodeURIComponent('zzzz')}`)).json()) as { cuentas: unknown[] }).cuentas).toHaveLength(0)
  expect((await get(page, `/api/restaurante/cuentas?q=${encodeURIComponent('x'.repeat(61))}`)).status()).toBe(400)

  await login(context, B, 'admin', adminB)
  expect(((await (await get(page, '/api/restaurante/cuentas')).json()) as { cuentas: unknown[] }).cuentas).toHaveLength(0)
  expect((await get(page, `/api/restaurante/cuentas/${account5}`)).status()).toBe(404)
  expect((await addItem(page, account5, { product_id: carta.pasta, quantity: 1 })).status()).toBe(404)
  expect((await page.request.delete(`${BASE}/api/restaurante/cuentas/${account5}/items/1`, { data: {} })).status()).toBe(404)
  expect((await get(page, `/restaurante/cuenta/${account5}`)).status()).toBe(404)
  expect((await post(page, '/api/restaurante/cuentas', { table_id: table4, guests: 2 })).status()).toBe(404) // mesa de otro negocio
  expect(businessId('zzkds-b')).toBe(B)
})

for (const vp of [{ w: 375, h: 812, who: 'waiter' as const }, { w: 1280, h: 800, who: 'cashier' as const }]) {
  test(`7 · a ${vp.w}px: plano con la mesa ocupada, cuenta con total en USD y Bs y agregar un ítem desde la pantalla`, async ({ page, context }) => {
    await login(context, A, vp.who, vp.who === 'waiter' ? waiter : cashier)
    await page.setViewportSize({ width: vp.w, height: vp.h })

    await page.goto('/restaurante/mesas')
    await expect(page.getByRole('heading', { name: 'Salón' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Mesa 5,.*ocupada/ })).toBeVisible()
    expect(await noOverflow(page)).toBe(true)
    await page.screenshot({ path: path.join(SHOTS, `plano-${vp.w}.png`), fullPage: true })

    await page.getByRole('button', { name: /^Mesa 5,/ }).click()
    await expect(page).toHaveURL(new RegExp(`/restaurante/cuenta/${account5}$`))
    await expect(page.getByRole('heading', { name: /Mesa 5/ })).toBeVisible()
    await expect(page.getByLabel('Total de la cuenta')).toContainText('$30.00')
    await expect(page.getByLabel('Total de la cuenta')).toContainText('Bs.')
    await expect(page.getByText('Extra queso')).toBeVisible()
    expect(await noOverflow(page)).toBe(true)
    await page.screenshot({ path: path.join(SHOTS, `cuenta-${vp.w}.png`), fullPage: true })

    // Agregar desde la pantalla: buscar, elegir, cantidad, curso y nota.
    await page.getByRole('button', { name: 'Agregar ítem' }).click()
    const dialog = page.getByRole('dialog') // su título cambia al elegir producto: no se busca por nombre
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Buscar producto').fill('cerveza')
    await dialog.getByRole('button', { name: /ZZ Cerveza Polar/ }).click()
    // Cerveza tiene un grupo obligatorio ("Término"): sin elegir no deja agregar.
    await expect(dialog.getByRole('button', { name: /^Agregar ·/ })).toBeDisabled()
    await dialog.getByLabel('Medio').check()
    await dialog.getByRole('button', { name: 'Más' }).click()
    await dialog.getByRole('radio', { name: '3 Postre' }).click()
    await dialog.getByLabel('Nota para cocina').fill('bien fría')
    await expect(dialog.getByRole('button', { name: /^Agregar · \$6\.00 \/ Bs\./ })).toBeVisible()
    await expect(dialog).toHaveCSS('opacity', '1')
    expect(await noOverflow(page)).toBe(true)
    await page.screenshot({ path: path.join(SHOTS, `selector-${vp.w}.png`) })
    await dialog.getByRole('button', { name: /^Agregar ·/ }).click()

    await expect(page.getByLabel('Total de la cuenta')).toContainText('$36.00')
    await expect(page.getByText('bien fría').first()).toBeVisible()
    const cerveza = page.getByRole('listitem').filter({ hasText: 'ZZ Cerveza Polar' }).filter({ hasText: 'Borrador' })
    await expect(cerveza).toContainText('2×')

    // Quitar el borrador con confirmación.
    await cerveza.getByRole('button', { name: /Quitar/ }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Quitar ítem' }).click()
    await expect(page.getByLabel('Total de la cuenta')).toContainText('$30.00')
    await page.screenshot({ path: path.join(SHOTS, `cuenta-final-${vp.w}.png`), fullPage: true })
  })
}

test('8 · abrir mesa desde el plano (móvil): comensales, mesonero propio y entra a la cuenta', async ({ page, context }) => {
  await login(context, A, 'waiter', waiter)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/restaurante/mesas')
  await page.getByRole('button', { name: /^Mesa 7,.*libre/ }).click()
  const dialog = page.getByRole('dialog', { name: /Mesa 7/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Mesonero')).toHaveCount(0) // el mesonero siempre abre a su nombre
  await dialog.getByRole('button', { name: 'Más comensales' }).click()
  await expect(dialog).toHaveCSS('opacity', '1')
  await page.screenshot({ path: path.join(SHOTS, `abrir-mesa-375.png`) })
  await dialog.getByRole('button', { name: 'Abrir cuenta' }).click()
  await expect(page).toHaveURL(/\/restaurante\/cuenta\/\d+$/)
  await expect(page.getByRole('heading', { name: /Mesa 7/ })).toBeVisible()
  expect(sql(`SELECT guests, waiter_id FROM orders WHERE business_id=${A} AND table_id=(SELECT id FROM dining_tables WHERE business_id=${A} AND label='7') AND account_status='open'`)).toBe(`3\t${waiter}`)
  await page.screenshot({ path: path.join(SHOTS, 'cuenta-vacia-375.png'), fullPage: true })
})

for (const vp of [{ w: 1280, h: 800 }, { w: 375, h: 812 }]) {
  test(`9 · Configuración › Restaurante › Modificadores a ${vp.w}px (admin)`, async ({ page, context }) => {
    await login(context, A, 'admin', admin)
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await page.goto('/configuracion?tab=restaurante')
    await page.getByRole('button', { name: /^Modificadores/ }).click()
    await expect(page.getByRole('heading', { name: 'Modificadores', exact: true })).toBeVisible()
    await expect(page.getByText('Extra queso')).toBeVisible()
    await expect(page.getByText('ZZ Pasta carbonara')).toBeVisible() // el ámbito: este producto
    await expect(page.getByText('Obligatorio').first()).toBeVisible()
    expect(await noOverflow(page)).toBe(true)
    await page.screenshot({ path: path.join(SHOTS, `config-modificadores-${vp.w}.png`), fullPage: true })

    // Crear uno nuevo desde la pantalla.
    await page.getByLabel('Nombre', { exact: true }).fill('Sin cebolla')
    await page.getByRole('button', { name: 'Agregar modificador' }).click()
    await expect(page.getByText('Sin cebolla').first()).toBeVisible()
    // Sin elegir ámbito queda para todo el negocio.
    expect(Number(sql(`SELECT COUNT(*) FROM product_modifiers WHERE business_id=${A} AND name='Sin cebolla' AND product_id IS NULL AND category_id IS NULL`))).toBeGreaterThanOrEqual(1)
  })
}
