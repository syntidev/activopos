import { expect, test, type Page } from '@playwright/test'
import { BASE, ensureBusiness, ensureUser, login, seedCarta, sql, type CartaSeed } from './helpers/restaurante-kds'

/**
 * Restaurante R2.1 — hallazgos de CLI-C.
 * A1: una cuenta de mesa no se opera desde Pedidos. A2: el KDS actual no la lista. A3: gratis no activa el módulo.
 * M3: las agregaciones de pedidos no cuentan cuentas de mesa. Solo activopos_kds.
 */

test.use({ storageState: { cookies: [], origins: [] }, baseURL: BASE })
test.describe.configure({ mode: 'serial' })

let A = 0, E = 0, admin = 0
let carta: CartaSeed
let tableId = 0, accountId = 0, normalId = 0

const call = (page: Page, method: 'POST' | 'PATCH', url: string, data: Record<string, unknown>) =>
  page.request.fetch(`${BASE}${url}`, { method, data })

test.beforeAll(() => {
  A = ensureBusiness('zzkds-a', true)
  E = ensureBusiness('zzkds-e', false)
  admin = ensureUser(A, 'admin', 'Admin Guardas')
  carta = seedCarta(A)
  // Pedido normal de control (origin pos), con una línea de kds_status NULL como todas las de los pedidos de siempre.
  sql(`DELETE oi FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.business_id=${A} AND o.order_number LIKE 'ZZ-%'`)
  sql(`DELETE FROM orders WHERE business_id=${A} AND order_number LIKE 'ZZ-%'`)
  sql(`INSERT INTO orders (business_id,order_number,status,origin,total_usd,total_bs,rate_used,updated_at) VALUES (${A},'ZZ-N1','received','pos',14,500,35.7142,NOW(3))`)
  normalId = Number(sql(`SELECT id FROM orders WHERE business_id=${A} AND order_number='ZZ-N1'`))
  sql(`INSERT INTO order_items (order_id,product_id,product_name,quantity,price_per_unit_usd,subtotal_usd) VALUES (${normalId},${carta.pasta},'ZZ Pasta carbonara',1,14,14)`)
})

test('0 · preparación: una cuenta de mesa con un ítem', async ({ page, context }) => {
  await login(context, A, 'admin', admin)
  const area = ((await (await call(page, 'POST', '/api/restaurante/areas', { name: 'Salón' })).json()) as { area: { id: number } }).area
  const t = ((await (await call(page, 'POST', '/api/restaurante/mesas', { area_id: area.id, label: '1', capacity: 4 })).json()) as { tables: Array<{ id: number }> }).tables[0]
  tableId = t.id
  const acc = ((await (await call(page, 'POST', '/api/restaurante/cuentas', { table_id: tableId, guests: 2, waiter_id: admin })).json()) as { account: { id: number } }).account
  accountId = acc.id
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${accountId}/items`, { product_id: carta.pasta, quantity: 2 })).status()).toBe(201)
})

test('A1 · ninguna ruta de Pedidos opera una cuenta de mesa (422 TABLE_ORDER_USE_ACCOUNT) y la cuenta queda intacta', async ({ page, context }) => {
  await login(context, A, 'admin', admin)
  const antes = sql(`SELECT CONCAT_WS('|', status, account_status, price_mode, total_usd, IFNULL(sale_id,'-'), (SELECT COUNT(*) FROM order_items WHERE order_id=o.id)) FROM orders o WHERE id=${accountId}`)
  const ventas = sql(`SELECT COUNT(*) FROM sales WHERE business_id=${A}`)

  const casos: Array<[string, 'POST' | 'PATCH', string, Record<string, unknown>]> = [
    ['cobrar',                 'POST',  `/api/orders/${accountId}/cobrar`,                       { payment_method_id: 1 }],
    ['cerrar-credito',         'POST',  `/api/orders/${accountId}/cerrar-credito`,               { confirmed_client_id: 1, credit_days: 30 }],
    ['cancelar',               'POST',  `/api/orders/${accountId}/cancelar`,                     {}],
    ['items',                  'PATCH', `/api/orders/${accountId}/items`,                        { items: [{ product_id: carta.pasta, product_name: 'x', quantity: 1 }] }],
    ['cobrar-deuda',           'POST',  `/api/orders/${accountId}/cobrar-deuda-financiamiento`,  { payment_method_id: 1, amount_usd: 1 }],
    ['price-mode',             'PATCH', `/api/orders/${accountId}/price-mode`,                   { price_mode: 'bcv' }],
    ['financing',              'PATCH', `/api/orders/${accountId}/financing`,                    { action: 'request' }],
    ['shipping',               'PATCH', `/api/orders/${accountId}/shipping`,                     { ship_nombre: 'x' }],
    ['crear-cliente',          'POST',  `/api/orders/${accountId}/crear-cliente`,                {}],
    ['estado (PATCH /[id])',   'PATCH', `/api/orders/${accountId}`,                              { status: 'preparing' }],
  ]
  for (const [nombre, metodo, url, body] of casos) {
    const res = await call(page, metodo, url, body)
    expect(res.status(), nombre).toBe(422)
    expect(((await res.json()) as { code: string }).code, nombre).toBe('TABLE_ORDER_USE_ACCOUNT')
  }

  expect(sql(`SELECT CONCAT_WS('|', status, account_status, price_mode, total_usd, IFNULL(sale_id,'-'), (SELECT COUNT(*) FROM order_items WHERE order_id=o.id)) FROM orders o WHERE id=${accountId}`)).toBe(antes)
  expect(sql(`SELECT COUNT(*) FROM sales WHERE business_id=${A}`)).toBe(ventas)
})

test('A1 · control: un pedido normal sigue funcionando (reprecio con línea kds_status NULL y cancelar)', async ({ page, context }) => {
  await login(context, A, 'admin', admin)
  const reprecio = await call(page, 'PATCH', `/api/orders/${normalId}/price-mode`, { price_mode: 'bcv' })
  expect(reprecio.status()).toBe(200)
  // El filtro de líneas anuladas no excluye las líneas con kds_status NULL (todas las de los pedidos de siempre).
  expect(sql(`SELECT COUNT(*) FROM order_items WHERE order_id=${normalId}`)).toBe('1')
  expect(sql(`SELECT total_usd FROM orders WHERE id=${normalId}`)).toBe('14.00')
})

test('A2 · /api/kds/orders no lista cuentas de mesa pero sí los pedidos normales', async ({ page, context }) => {
  await login(context, A, 'admin', admin)
  const res = await page.request.get(`${BASE}/api/kds/orders`)
  expect(res.status()).toBe(200)
  const ids = ((await res.json()) as { orders: Array<{ id: number }> }).orders.map(o => o.id)
  expect(ids).toContain(normalId)
  expect(ids).not.toContain(accountId)
  // Y el KDS de siempre (por send_to_kds) tampoco.
  const viejo = ((await (await page.request.get(`${BASE}/api/orders?status=received&send_to_kds=true&limit=100`)).json()) as { orders: Array<{ id: number }> }).orders
  expect(viejo.map(o => o.id)).not.toContain(accountId)
})

test('A3 · el plan gratis no activa el módulo (403 PLAN_LIMIT); desactivar sigue permitido', async ({ page, context }) => {
  await login(context, E, 'admin', 1)
  sql(`UPDATE businesses SET catalog_plan='gratis', restaurante_enabled=0 WHERE id=${E}`)
  const res = await call(page, 'POST', '/api/restaurante/activacion', { enabled: true })
  expect(res.status()).toBe(403)
  const body = (await res.json()) as { code: string; error: string }
  expect(body.code).toBe('PLAN_LIMIT')
  expect(body.error).toContain('Negocio Activo')
  expect(sql(`SELECT restaurante_enabled FROM businesses WHERE id=${E}`)).toBe('0')

  // Un negocio gratis que ya lo tenía puede apagarlo.
  sql(`UPDATE businesses SET restaurante_enabled=1 WHERE id=${E}`)
  expect((await call(page, 'POST', '/api/restaurante/activacion', { enabled: false })).status()).toBe(200)
  expect(sql(`SELECT restaurante_enabled FROM businesses WHERE id=${E}`)).toBe('0')

  // Con plan de pago sí activa.
  sql(`UPDATE businesses SET catalog_plan='negocio_activo' WHERE id=${E}`)
  expect((await call(page, 'POST', '/api/restaurante/activacion', { enabled: true })).status()).toBe(200)
})

test('M3 · el contador de pedidos pendientes no cuenta la cuenta de mesa', async ({ page, context }) => {
  await login(context, A, 'admin', admin)
  const counts = (await (await page.request.get(`${BASE}/api/notifications/counts`)).json()) as { pending_orders: number }
  // Hay una cuenta de mesa en 'received' y un pedido normal en 'received': solo cuenta el pedido normal.
  expect(counts.pending_orders).toBe(1)
})
