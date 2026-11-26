import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { BASE, CAPTURAS, ensureBusiness, ensureUser, login, seedCarta, sql, type CartaSeed } from './helpers/restaurante-kds'

/**
 * Restaurante R3 — estaciones, ruteo y KDS. Casos del PLAN (1–7) + M1 (usuarios mesonero/cocinero), M2 (whitelist de cocina),
 * B1 (user_stations aisladas por negocio) y el cursor `since`. Solo activopos_kds.
 */

test.use({ storageState: { cookies: [], origins: [] }, baseURL: BASE })
test.describe.configure({ mode: 'serial' })

const R3 = path.join(CAPTURAS, 'r3')

let A = 0, E = 0
let admin = 0, waiter = 0, cook = 0, bartender = 0, foreign = 0
let carta: CartaSeed
let cocina = 0, barra = 0
let areaId = 0, t1 = 0, t2 = 0
let acc1 = 0, acc2 = 0
let pastaItem = 0, cervezaItem = 0

type Json = Record<string, unknown>
const call = async (page: Page, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, data?: Json) =>
  page.request.fetch(`${BASE}${url}`, { method, data })
const body = async <T>(r: Awaited<ReturnType<typeof call>>): Promise<T> => (await r.json()) as T

interface Board { stations: Array<{ id: number; name: string }>; tickets: Array<{ order_id: number; station_id: number; items: Array<{ id: number; product_name: string; status: string; held: boolean; course: number }> }>; server_time: string; changed: number[] | null }
const board = async (page: Page, qs = ''): Promise<Board> => body<Board>(await call(page, 'GET', `/api/restaurante/kds?station=todas${qs}`))
const names = (b: Board, station: number): string[] => b.tickets.filter(t => t.station_id === station).flatMap(t => t.items.map(i => i.product_name))

test.beforeAll(() => {
  A = ensureBusiness('zzkds-a', true)
  E = ensureBusiness('zzkds-e', false)
  admin = ensureUser(A, 'admin', 'Admin R3')
  waiter = ensureUser(A, 'waiter', 'Maria P')
  cook = ensureUser(A, 'kitchen', 'Cocinero Uno')
  bartender = ensureUser(A, 'kitchen', 'Barman Dos')
  foreign = ensureUser(E, 'kitchen', 'Cocinero Ajeno')
  carta = seedCarta(A)
  fs.mkdirSync(R3, { recursive: true })
})

test('1 · estaciones y ruteo: plato → Cocina, cerveza → Barra; cada pantalla recibe solo lo suyo', async ({ page, context }) => {
  await login(context, A, 'admin', admin)
  const c = await body<{ station: { id: number; is_default: boolean } }>(await call(page, 'POST', '/api/restaurante/estaciones', { name: 'Cocina', warn_min: 10, critical_min: 20 }))
  cocina = c.station.id
  expect(c.station.is_default).toBe(true) // la primera queda por defecto
  barra = (await body<{ station: { id: number } }>(await call(page, 'POST', '/api/restaurante/estaciones', { name: 'Barra', warn_min: 5, critical_min: 10 }))).station.id
  expect((await call(page, 'PATCH', `/api/restaurante/estaciones/${barra}`, { warn_min: 20, critical_min: 10 })).status()).toBe(422) // rojo > ámbar

  // Categoría de platos exige preparación (cae a la estación por defecto); la cerveza tiene override a Barra.
  expect((await call(page, 'PUT', '/api/restaurante/ruteo', { category_id: carta.categoryId, station_id: null, requires_preparation: true })).status()).toBe(200)
  expect((await call(page, 'PUT', '/api/restaurante/ruteo', { product_id: carta.cerveza, station_id: barra })).status()).toBe(200)

  // B1: cocineros asignados por el admin; un usuario de OTRO negocio se rechaza y no se escribe nada.
  expect((await call(page, 'PATCH', `/api/restaurante/estaciones/${cocina}`, { user_ids: [cook] })).status()).toBe(200)
  expect((await call(page, 'PATCH', `/api/restaurante/estaciones/${barra}`, { user_ids: [bartender] })).status()).toBe(200)
  const ajeno = await call(page, 'PATCH', `/api/restaurante/estaciones/${barra}`, { user_ids: [bartender, foreign] })
  expect(ajeno.status()).toBe(422)
  expect(sql(`SELECT COUNT(*) FROM user_stations WHERE user_id=${foreign}`)).toBe('0')
  expect(sql(`SELECT COUNT(*) FROM user_stations WHERE station_id=${barra} AND user_id=${bartender}`)).toBe('1')

  areaId = (await body<{ area: { id: number } }>(await call(page, 'POST', '/api/restaurante/areas', { name: 'Salón' }))).area.id
  const mk = async (label: string) => (await body<{ tables: Array<{ id: number }> }>(await call(page, 'POST', '/api/restaurante/mesas', { area_id: areaId, label, capacity: 4 }))).tables[0].id
  t1 = await mk('4'); t2 = await mk('6')
  acc1 = (await body<{ account: { id: number } }>(await call(page, 'POST', '/api/restaurante/cuentas', { table_id: t1, guests: 2, waiter_id: waiter }))).account.id
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc1}/items`, { product_id: carta.pasta, quantity: 2 })).status()).toBe(201)
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc1}/items`, { product_id: carta.cerveza, quantity: 1 })).status()).toBe(201)

  await login(context, A, 'waiter', waiter)
  const sent = await call(page, 'POST', `/api/restaurante/cuentas/${acc1}/enviar`, {})
  expect(sent.status()).toBe(200)
  expect((await body<{ sent: number }>(sent)).sent).toBe(2)
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc1}/enviar`, {})).status()).toBe(422) // nada por enviar

  pastaItem = Number(sql(`SELECT id FROM order_items WHERE order_id=${acc1} AND product_id=${carta.pasta}`))
  cervezaItem = Number(sql(`SELECT id FROM order_items WHERE order_id=${acc1} AND product_id=${carta.cerveza}`))
  expect(sql(`SELECT station_id FROM order_items WHERE id=${pastaItem}`)).toBe(String(cocina))
  expect(sql(`SELECT station_id FROM order_items WHERE id=${cervezaItem}`)).toBe(String(barra))

  await login(context, A, 'kitchen', cook)
  const bCook = await board(page)
  expect(bCook.stations.map(s => s.name)).toEqual(['Cocina'])
  expect(names(bCook, cocina)).toEqual(['ZZ Pasta carbonara'])
  expect(JSON.stringify(bCook)).not.toMatch(/price|total|subtotal/i) // el KDS no lleva precios

  await login(context, A, 'kitchen', bartender)
  const bBar = await board(page)
  expect(names(bBar, barra)).toEqual(['ZZ Cerveza Polar'])
  expect(names(bBar, cocina)).toEqual([])
})

test('2 · el override por producto gana a la categoría; cambiar el ruteo no mueve lo ya enviado', async ({ page, context }) => {
  await login(context, A, 'admin', admin)
  // La cerveza ahora se rutea a Cocina (override cambiado): el ítem ya enviado conserva Barra.
  expect((await call(page, 'PUT', '/api/restaurante/ruteo', { product_id: carta.cerveza, station_id: cocina })).status()).toBe(200)
  expect(sql(`SELECT station_id FROM order_items WHERE id=${cervezaItem}`)).toBe(String(barra))
  // Y un ítem nuevo de cerveza sí va a la estación nueva.
  acc2 = (await body<{ account: { id: number } }>(await call(page, 'POST', '/api/restaurante/cuentas', { table_id: t2, guests: 2, waiter_id: waiter }))).account.id
  await call(page, 'POST', `/api/restaurante/cuentas/${acc2}/items`, { product_id: carta.cerveza, quantity: 1 })
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc2}/enviar`, {})).status()).toBe(200)
  expect(sql(`SELECT station_id FROM order_items WHERE order_id=${acc2}`)).toBe(String(cocina))
  expect((await call(page, 'PUT', '/api/restaurante/ruteo', { product_id: carta.cerveza, station_id: barra })).status()).toBe(200)
})

test('3 · iniciar → listo fija los tiempos; el mesonero ve el badge de listo en ≤ 5 s', async ({ page, context }) => {
  await login(context, A, 'kitchen', cook)
  expect((await call(page, 'PATCH', `/api/restaurante/kds/items/${pastaItem}`, { action: 'listo', scope: 'comanda' })).status()).toBe(409) // aún no se inició
  expect((await call(page, 'PATCH', `/api/restaurante/kds/items/${pastaItem}`, { action: 'iniciar', scope: 'comanda' })).status()).toBe(200)
  expect(sql(`SELECT kds_status FROM order_items WHERE id=${pastaItem}`)).toBe('preparing')
  expect(Number(sql(`SELECT started_by FROM order_items WHERE id=${pastaItem}`))).toBe(cook)
  expect(sql(`SELECT started_at IS NOT NULL FROM order_items WHERE id=${pastaItem}`)).toBe('1')
  // Otra pantalla ya lo inició: 409 STALE, sin duplicar el cambio.
  const again = await call(page, 'PATCH', `/api/restaurante/kds/items/${pastaItem}`, { action: 'iniciar', scope: 'comanda' })
  expect(again.status()).toBe(409)
  expect((await body<{ code: string }>(again)).code).toBe('STALE')
  expect((await call(page, 'PATCH', `/api/restaurante/kds/items/${pastaItem}`, { action: 'listo', scope: 'comanda' })).status()).toBe(200)
  expect(sql(`SELECT ready_at IS NOT NULL FROM order_items WHERE id=${pastaItem}`)).toBe('1')
  // Deshacer dentro de 30 s: vuelve a preparing y limpia ready_at; luego listo otra vez.
  expect((await call(page, 'PATCH', `/api/restaurante/kds/items/${pastaItem}`, { action: 'deshacer', scope: 'comanda' })).status()).toBe(200)
  expect(sql(`SELECT kds_status FROM order_items WHERE id=${pastaItem}`)).toBe('preparing')
  expect((await call(page, 'PATCH', `/api/restaurante/kds/items/${pastaItem}`, { action: 'listo', scope: 'comanda' })).status()).toBe(200)

  // El mesonero ve el badge en el plano SIN recargar (sondeo de 5 s).
  await login(context, A, 'waiter', waiter)
  await page.goto('/restaurante/mesas')
  await expect(page.getByRole('button', { name: /Mesa 4.*1 por servir/ })).toBeVisible({ timeout: 7_000 })
  const mesas = await body<{ tables: Array<{ id: number; ready_items: number }> }>(await call(page, 'GET', '/api/restaurante/mesas'))
  expect(mesas.tables.find(t => t.id === t1)?.ready_items).toBe(1)

  // Servido: sale del tablero de cocina y del badge.
  expect((await call(page, 'PATCH', `/api/restaurante/kds/items/${pastaItem}`, { action: 'servido', order_id: acc1 })).status()).toBe(200)
  expect(sql(`SELECT kds_status FROM order_items WHERE id=${pastaItem}`)).toBe('served')
})

test('4 · el curso 2 espera al curso 1 y "Disparar" lo libera', async ({ page, context }) => {
  await login(context, A, 'admin', admin)
  const t3 = (await body<{ tables: Array<{ id: number }> }>(await call(page, 'POST', '/api/restaurante/mesas', { area_id: areaId, label: '8', capacity: 2 }))).tables[0].id
  const acc = (await body<{ account: { id: number } }>(await call(page, 'POST', '/api/restaurante/cuentas', { table_id: t3, guests: 2, waiter_id: waiter }))).account.id
  await call(page, 'POST', `/api/restaurante/cuentas/${acc}/items`, { product_id: carta.pasta, quantity: 1, course: 1 })
  await call(page, 'POST', `/api/restaurante/cuentas/${acc}/items`, { product_id: carta.pasta, quantity: 3, course: 2 })
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc}/enviar`, {})).status()).toBe(200)

  const find = (b: Board) => b.tickets.find(t => t.order_id === acc)?.items ?? []
  expect(find(await board(page)).map(i => [i.course, i.held])).toEqual([[1, false], [2, true]])
  const c2 = Number(sql(`SELECT id FROM order_items WHERE order_id=${acc} AND course=2`))
  await login(context, A, 'kitchen', cook)
  const blocked = await call(page, 'PATCH', `/api/restaurante/kds/items/${c2}`, { action: 'iniciar', scope: 'item' })
  expect(blocked.status()).toBe(422) // espera al curso 1
  // Disparar (mesonero): el curso 2 deja de esperar sin cerrar el 1.
  await login(context, A, 'waiter', waiter)
  expect((await call(page, 'POST', '/api/restaurante/kds/disparar', { order_id: acc, course: 2 })).status()).toBe(200)
  await login(context, A, 'kitchen', cook)
  expect(find(await board(page)).map(i => i.held)).toEqual([false, false])
  expect(sql(`SELECT COUNT(*) FROM table_events WHERE order_id=${acc} AND type='fire'`)).toBe('1')
})

test('5 · ítem enviado y anulado aparece tachado en cocina; sin admin no se anula; "Visto" lo retira', async ({ page, context }) => {
  await login(context, A, 'waiter', waiter)
  const noAdmin = await call(page, 'DELETE', `/api/restaurante/cuentas/${acc1}/items/${cervezaItem}`, { reason: 'cliente cambió' })
  expect(noAdmin.status()).toBe(403)
  expect(sql(`SELECT kds_status FROM order_items WHERE id=${cervezaItem}`)).toBe('sent')

  await login(context, A, 'admin', admin)
  expect((await call(page, 'DELETE', `/api/restaurante/cuentas/${acc1}/items/${cervezaItem}`, { reason: 'cliente cambió' })).status()).toBe(200)

  await login(context, A, 'kitchen', bartender)
  const voided = (await board(page)).tickets.flatMap(t => t.items).find(i => i.id === cervezaItem)
  expect(voided?.status).toBe('void')
  expect((await call(page, 'PATCH', `/api/restaurante/kds/items/${cervezaItem}`, { action: 'visto', scope: 'comanda' })).status()).toBe(200)
  expect((await board(page)).tickets.flatMap(t => t.items).some(i => i.id === cervezaItem)).toBe(false)
})

test('6 · cocina: 403 en cuentas y precios, y solo ve sus estaciones', async ({ page, context }) => {
  await login(context, A, 'kitchen', cook)
  for (const [m, u] of [['GET', `/api/restaurante/cuentas/${acc1}`], ['GET', '/api/restaurante/productos'], ['GET', '/api/restaurante/estaciones'], ['GET', '/api/restaurante/mesas']] as const) {
    expect((await call(page, m, u)).status(), u).toBe(403)
  }
  const other = await call(page, 'GET', `/api/restaurante/kds?station=${barra}`)
  expect(other.status()).toBe(403) // estación que no tiene asignada
  const item = Number(sql(`SELECT id FROM order_items WHERE order_id=${acc2} LIMIT 1`))
  expect((await call(page, 'PATCH', `/api/restaurante/kds/items/${item}`, { action: 'iniciar', scope: 'item' })).status()).toBe(200) // acc2 → Cocina: sí es suya
  await login(context, A, 'waiter', waiter)
  expect((await call(page, 'GET', '/api/restaurante/kds')).status()).toBe(403) // el mesonero no ve el tablero de cocina
})

test('7 · tablet 1024×768 sin scroll horizontal y los umbrales ámbar/rojo cambian con el tiempo', async ({ page, context }) => {
  // acc2 (Cocina, umbral 10/20): reciente → normal; hace 12 min → ámbar; hace 25 min → rojo.
  await login(context, A, 'kitchen', cook)
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/kds')
  await expect(page.getByRole('article', { name: 'Comanda 6' })).toBeVisible({ timeout: 8_000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const color = async () => page.getByRole('article', { name: 'Comanda 6' }).locator('> div').first().evaluate(el => getComputedStyle(el).backgroundColor)
  const fresca = await color()
  sql(`UPDATE order_items SET sent_at = UTC_TIMESTAMP(3) - INTERVAL 12 MINUTE, kds_updated_at = UTC_TIMESTAMP(3) WHERE order_id=${acc2}`)
  await expect.poll(color, { timeout: 8_000 }).not.toBe(fresca)
  const ambar = await color()
  sql(`UPDATE order_items SET sent_at = UTC_TIMESTAMP(3) - INTERVAL 25 MINUTE, kds_updated_at = UTC_TIMESTAMP(3) WHERE order_id=${acc2}`)
  await expect.poll(color, { timeout: 8_000 }).not.toBe(ambar)
})

test('M1 · el admin crea mesonero y cocinero solo con el módulo habilitado', async ({ page, context }) => {
  // El plan tiene tope de usuarios por negocio: se retiran los sobrantes de otros specs (los que tengan historial se quedan).
  for (const email of ['m1-%', 'zzkds-%-adminguardas@%', 'zzkds-%-adminsalon@%', 'zzkds-%-cajasalon@%', 'zzkds-%-luisr@%', 'zzkds-%-cajera@%']) {
    try { sql(`DELETE FROM users WHERE business_id=${A} AND email LIKE '${email}'`) } catch { /* con historial: se queda */ }
  }
  await login(context, A, 'admin', admin)
  const mk = (bid: string, role: string) => call(page, 'POST', '/api/users', { name: `Nuevo ${role} ${bid}`, email: `m1-${role}-${bid}-${Date.now()}@zzkds.test`, password: 'clave-segura-1', role })
  expect((await mk('a', 'waiter')).status()).toBe(201)
  expect((await mk('a', 'kitchen')).status()).toBe(201)
  expect(sql(`SELECT COUNT(*) FROM users WHERE business_id=${A} AND email LIKE 'm1-%' AND role IN ('waiter','kitchen')`)).toBe('2')
  sql(`DELETE FROM users WHERE business_id=${A} AND email LIKE 'm1-%'`)

  await login(context, E, 'admin', ensureUser(E, 'admin', 'Admin E'))
  const sinModulo = await mk('e', 'waiter')
  expect(sinModulo.status()).toBe(422) // negocio sin Restaurante
  await login(context, A, 'cashier', ensureUser(A, 'cashier', 'Cajera'))
  expect((await mk('a', 'kitchen')).status()).not.toBe(201) // un cajero no crea usuarios (middleware o 403)
  expect(sql(`SELECT COUNT(*) FROM users WHERE business_id=${A} AND email LIKE 'm1-%'`)).toBe('0')
})

test('M2 · la cocina puede leer /api/kds/orders (whitelist) pero no operar pedidos', async ({ page, context }) => {
  await login(context, A, 'kitchen', cook)
  expect(await call(page, 'GET', '/api/kds/orders').then(r => r.status())).not.toBe(403)
  expect((await call(page, 'GET', '/api/orders')).status()).toBe(403)
})

test('since · el sondeo solo baja lo que cambió', async ({ page, context }) => {
  await login(context, A, 'kitchen', cook)
  const full = await board(page)
  expect(full.changed).toBeNull()
  expect(full.tickets.length).toBeGreaterThan(0)
  const quiet = await board(page, `&since=${encodeURIComponent(full.server_time)}`)
  expect(quiet.tickets).toEqual([])
  expect(quiet.changed).toEqual([])
  // Un cambio de otra pantalla: solo esa cuenta vuelve.
  const item = Number(sql(`SELECT id FROM order_items WHERE order_id=${acc2} LIMIT 1`))
  await call(page, 'PATCH', `/api/restaurante/kds/items/${item}`, { action: 'listo', scope: 'comanda' })
  const delta = await board(page, `&since=${encodeURIComponent(quiet.server_time)}`)
  expect(delta.changed).toEqual([acc2])
  expect(delta.tickets.map(t => t.order_id)).toEqual([acc2])
})

test('sin flag · negocio sin Restaurante: /api/restaurante/kds es 404 y el KDS de siempre sigue', async ({ page, context }) => {
  await login(context, E, 'admin', ensureUser(E, 'admin', 'Admin E'))
  expect((await call(page, 'GET', '/api/restaurante/kds')).status()).toBe(404)
  await page.goto('/kds')
  await expect(page.getByRole('link', { name: 'Pedidos normales' })).toHaveCount(0)
})

test('Listas · muestra el tiempo hasta que quedó lista (fijo), no el reloj corrido desde el envío', async ({ page, context }) => {
  await login(context, A, 'admin', admin)
  const tid = (await body<{ tables: Array<{ id: number }> }>(await call(page, 'POST', '/api/restaurante/mesas', { area_id: areaId, label: '15', capacity: 2 }))).tables[0].id
  const acc = (await body<{ account: { id: number } }>(await call(page, 'POST', '/api/restaurante/cuentas', { table_id: tid, guests: 1, waiter_id: waiter }))).account.id
  await call(page, 'POST', `/api/restaurante/cuentas/${acc}/items`, { product_id: carta.pasta, quantity: 1 })
  await call(page, 'POST', `/api/restaurante/cuentas/${acc}/enviar`, {})
  // Enviada hace 5 min y lista hace 2: tardó 03:00 y ese número no debe seguir corriendo.
  sql(`UPDATE order_items SET kds_status='ready', sent_at = UTC_TIMESTAMP(3) - INTERVAL 5 MINUTE, ready_at = UTC_TIMESTAMP(3) - INTERVAL 2 MINUTE, kds_updated_at = UTC_TIMESTAMP(3) WHERE order_id=${acc}`)

  await login(context, A, 'kitchen', cook)
  const t = (await board(page)).tickets.find(x => x.order_id === acc) as (Board['tickets'][number] & { ready_at: string | null; sent_at: string }) | undefined
  expect(t?.ready_at).not.toBeNull()
  expect((new Date(t?.ready_at ?? 0).getTime() - new Date(t?.sent_at ?? 0).getTime()) / 1000).toBeCloseTo(180, 0)

  await page.goto('/kds')
  const card = page.getByRole('article', { name: 'Comanda 15' })
  await expect(card).toBeVisible({ timeout: 8_000 })
  await expect(card).toContainText('03:00')
  await page.waitForTimeout(2_500)
  await expect(card).toContainText('03:00')
})

test('capturas · KDS 1280 y 375, sin conexión, config y cuenta', async ({ page, context }) => {
  // Más comandas con distintas edades para que el tablero muestre todo el lenguaje de color.
  await login(context, A, 'admin', admin)
  const mesa = async (label: string, minutes: number, status: 'sent' | 'preparing' | 'ready', qty: number): Promise<void> => {
    const tid = (await body<{ tables: Array<{ id: number }> }>(await call(page, 'POST', '/api/restaurante/mesas', { area_id: areaId, label, capacity: 4 }))).tables[0].id
    const acc = (await body<{ account: { id: number } }>(await call(page, 'POST', '/api/restaurante/cuentas', { table_id: tid, guests: 2, waiter_id: waiter }))).account.id
    await call(page, 'POST', `/api/restaurante/cuentas/${acc}/items`, { product_id: carta.pasta, quantity: qty, note: 'bien cocido' })
    await call(page, 'POST', `/api/restaurante/cuentas/${acc}/enviar`, {})
    sql(`UPDATE order_items SET kds_status='${status}', sent_at = UTC_TIMESTAMP(3) - INTERVAL ${minutes} MINUTE, kds_updated_at = UTC_TIMESTAMP(3), ready_at = IF(kds_status='ready', UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE, NULL) WHERE order_id=${acc}`)
  }
  await mesa('9', 1, 'sent', 2); await mesa('11', 12, 'preparing', 3); await mesa('12', 24, 'preparing', 2); await mesa('13', 3, 'ready', 1)

  await login(context, A, 'kitchen', cook)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/kds')
  await expect(page.getByRole('article', { name: 'Comanda 12' })).toBeVisible({ timeout: 8_000 })
  await page.screenshot({ path: path.join(R3, 'kds-1280.png'), fullPage: true })
  await page.setViewportSize({ width: 375, height: 800 })
  await page.reload()
  await expect(page.getByRole('tab', { name: /Prep\./ })).toBeVisible({ timeout: 8_000 })
  await page.getByRole('tab', { name: /Prep\./ }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: path.join(R3, 'kds-375.png'), fullPage: true })

  // Sin conexión: banner y cola.
  await context.setOffline(true)
  await page.getByRole('tab', { name: /Nuevas/ }).click()
  await expect(page.getByText(/SIN CONEXIÓN/)).toBeVisible({ timeout: 8_000 })
  await page.screenshot({ path: path.join(R3, 'kds-375-offline.png'), fullPage: true })
  await context.setOffline(false)

  await login(context, A, 'admin', admin)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/configuracion?tab=restaurante')
  await page.getByRole('button', { name: 'Estaciones y ruteo' }).click()
  await expect(page.getByRole('heading', { name: 'Ruteo por categoría' })).toBeVisible({ timeout: 8_000 })
  await page.screenshot({ path: path.join(R3, 'config-estaciones-1280.png'), fullPage: true })

  await login(context, A, 'waiter', waiter)
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto(`/restaurante/cuenta/${acc1}`)
  await expect(page.getByText('Enviar a cocina').first()).toBeVisible({ timeout: 8_000 })
  await page.screenshot({ path: path.join(R3, 'cuenta-375.png'), fullPage: true })
})

/* ── Hallazgos de CLI-C sobre R3 ── */

/** Cuenta nueva (admin) con ítems enviados; devuelve su id. */
async function accountWith(page: Page, label: string, items: Array<[number, number, number]>): Promise<number> {
  const t = (await body<{ tables: Array<{ id: number }> }>(await call(page, 'POST', '/api/restaurante/mesas', { area_id: areaId, label, capacity: 2 }))).tables[0].id
  const id = (await body<{ account: { id: number } }>(await call(page, 'POST', '/api/restaurante/cuentas', { table_id: t, guests: 1, waiter_id: waiter }))).account.id
  for (const [product_id, quantity, course] of items) await call(page, 'POST', `/api/restaurante/cuentas/${id}/items`, { product_id, quantity, course })
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${id}/enviar`, {})).status()).toBe(200)
  return id
}

test('R3-1 · una estación con comandas vivas no se desactiva ni se elimina (409)', async ({ page, context }) => {
  await login(context, A, 'admin', admin)
  await accountWith(page, 'R31', [[carta.cerveza, 1, 1]]) // la cerveza va a Barra
  const off = await call(page, 'PATCH', `/api/restaurante/estaciones/${barra}`, { active: false })
  expect(off.status()).toBe(409)
  expect((await body<{ code: string }>(off)).code).toBe('STATION_BUSY')
  expect((await call(page, 'DELETE', `/api/restaurante/estaciones/${barra}`)).status()).toBe(409)
  expect(sql(`SELECT active FROM prep_stations WHERE id=${barra}`)).toBe('1')
})

test('R3-4 · /api/kds/orders solo muestra al cocinero lo ruteado a SUS estaciones', async ({ page, context }) => {
  sql(`UPDATE businesses SET modules_enabled = CONCAT(modules_enabled, ',kds') WHERE id=${A} AND modules_enabled NOT LIKE '%kds%'`)
  sql(`DELETE oi FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.business_id=${A} AND o.order_number='ZZ-K1'`)
  sql(`DELETE FROM orders WHERE business_id=${A} AND order_number='ZZ-K1'`)
  sql(`INSERT INTO orders (business_id,order_number,status,origin,total_usd,total_bs,rate_used,updated_at) VALUES (${A},'ZZ-K1','received','pos',17,600,35,NOW(3))`)
  const oid = Number(sql(`SELECT id FROM orders WHERE business_id=${A} AND order_number='ZZ-K1'`))
  sql(`INSERT INTO order_items (order_id,product_id,product_name,quantity,price_per_unit_usd,subtotal_usd) VALUES (${oid},${carta.pasta},'ZZ Pasta carbonara',1,14,14),(${oid},${carta.cerveza},'ZZ Cerveza Polar',1,3,3)`)

  const lines = async (uid: number): Promise<string[]> => {
    await login(context, A, 'kitchen', uid)
    const r = await call(page, 'GET', '/api/kds/orders')
    expect(r.status()).toBe(200)
    const o = (await body<{ orders: Array<{ order_number: string; items: Array<{ product_name: string }> }> }>(r)).orders.find(x => x.order_number === 'ZZ-K1')
    return (o?.items ?? []).map(i => i.product_name)
  }
  expect(await lines(cook)).toEqual(['ZZ Pasta carbonara'])      // cocinero de Cocina: sin la cerveza de Barra
  expect(await lines(bartender)).toEqual(['ZZ Pasta carbonara', 'ZZ Cerveza Polar']) // la pasta no está ruteada por producto: sigue visible; la cerveza es suya
  sql(`DELETE oi FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.business_id=${A} AND o.order_number='ZZ-K1'`)
  sql(`DELETE FROM orders WHERE business_id=${A} AND order_number='ZZ-K1'`)
})

test('R3-5 · Disparar respeta la estación del cocinero', async ({ page, context }) => {
  await login(context, A, 'admin', admin)
  const id = await accountWith(page, 'R35', [[carta.cerveza, 1, 1], [carta.cerveza, 1, 2]]) // todo en Barra
  await login(context, A, 'kitchen', cook) // el de Cocina
  expect((await call(page, 'POST', '/api/restaurante/kds/disparar', { order_id: id, course: 2 })).status()).toBe(403)
  await login(context, A, 'kitchen', bartender) // el de Barra
  expect((await call(page, 'POST', '/api/restaurante/kds/disparar', { order_id: id, course: 2 })).status()).toBe(200)
})

test('R3-2 · si los cambios superan el tope del sondeo con since, avisa refresh_full', async ({ page, context }) => {
  await login(context, A, 'kitchen', cook)
  const before = await board(page)
  // 101 cuentas con un ítem de Cocina cambiado "ahora" (más que el tope de 100 por sondeo).
  sql(`INSERT INTO orders (business_id,order_number,status,origin,account_status,total_usd,total_bs,rate_used,opened_at,updated_at)
       WITH RECURSIVE n AS (SELECT 1 i UNION ALL SELECT i+1 FROM n WHERE i<101)
       SELECT ${A}, CONCAT('ZZ-OV-', i), 'received', 'table', 'open', 14, 500, 35, UTC_TIMESTAMP(3), NOW(3) FROM n`)
  sql(`INSERT INTO order_items (order_id,product_id,product_name,quantity,price_per_unit_usd,subtotal_usd,station_id,kds_status,sent_at,kds_updated_at)
       SELECT o.id, ${carta.pasta}, 'ZZ Pasta carbonara', 1, 14, 14, ${cocina}, 'sent', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
       FROM orders o WHERE o.business_id=${A} AND o.order_number LIKE 'ZZ-OV-%'`)
  const delta = (await body<Board & { refresh_full: boolean }>(await call(page, 'GET', `/api/restaurante/kds?station=todas&since=${encodeURIComponent(before.server_time)}`)))
  expect(delta.refresh_full).toBe(true)
  expect(delta.tickets).toEqual([])
  expect((await board(page) as Board & { refresh_full: boolean }).refresh_full).toBe(false) // el tablero completo no lo pide
})
