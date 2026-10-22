import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { sql } from './alta-helpers'
import { BASE, BUSINESS_ID, SLUG, apiAs, cleanupTestProducts, tokenFor } from './p0-helpers'

/**
 * Cashea (financiamiento) declarado en el ticket — negocio 87 local. Contrato: .doc/CONTRATO_CASHEA_TICKET.md.
 * Cubre: pedido web válido, producto excluido (409), financiamiento apagado (409), cashea + divisa (409 en ambos sentidos),
 * transiciones y bitácora, cobro bloqueado sin aprobar (pedido y POS), todo o nada, y reportes/caja.
 */
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

interface Ticket { kind: string; id: number; status: string; price_mode: string; financing: { status: string; status_label: string; provider: string | null; phrase: string | null } | null }
interface SaleResp { id: number; status: string; price_mode: string; financing_status: string | null; total_usd: number | string }

const FIN_NAME = 'ZZ Cashea Pago'
const PIN_EMAIL = 'zz-cashea-pin@example.invalid'
const CASH_ID = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BUSINESS_ID} AND is_active=1 AND is_financing=0 AND type='cash' ORDER BY id LIMIT 1`))
const CASHIER_ID = Number(sql(`SELECT id FROM users WHERE business_id=${BUSINESS_ID} AND role='cashier' ORDER BY id LIMIT 1`))
const ids = { a: 0, excluido: 0, finMethod: 0 }
let seq = Date.now() % 1_000_000
let publico: APIRequestContext

const netStock = (productId: number): number =>
  Number(sql(`SELECT IFNULL(SUM(quantity) - SUM(waste), 0) FROM inventory_entries WHERE product_id=${productId}`))

function cleanup(): void {
  const prods = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Cashea%'`).split('\n').filter(Boolean)
  if (prods.length > 0) {
    const list = prods.join(',')
    sql(`DELETE oi FROM order_items oi WHERE oi.product_id IN (${list})`)
    sql(`DELETE FROM orders WHERE business_id=${BUSINESS_ID} AND client_name LIKE 'ZZ Cashea%'`)
    const sales = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${list})`).split('\n').filter(Boolean)
    if (sales.length > 0) {
      const sl = sales.join(',')
      sql(`DELETE FROM sale_payments WHERE sale_id IN (${sl})`)
      sql(`DELETE FROM sale_items WHERE sale_id IN (${sl})`)
      sql(`DELETE FROM sales WHERE business_id=${BUSINESS_ID} AND id IN (${sl})`)
    }
  }
  sql(`DELETE FROM users WHERE business_id=${BUSINESS_ID} AND email='${PIN_EMAIL}'`) // después de las ventas (discount_auth_by)
  sql(`DELETE FROM clients WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Cashea%'`)
  sql(`DELETE FROM payment_methods WHERE business_id=${BUSINESS_ID} AND name='${FIN_NAME}'`)
  sql(`DELETE FROM activity_logs WHERE business_id=${BUSINESS_ID} AND action LIKE 'financing_%'`)
  cleanupTestProducts('Cashea')
}

async function apiRole(userId: number, role: string): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await tokenFor(userId, role)}` } })
}

async function crear(api: APIRequestContext, data: Record<string, unknown>): Promise<number> {
  const r = await api.post('/api/products', { data })
  expect(r.status(), JSON.stringify(await r.json().catch(() => ({})))).toBe(201)
  return (await r.json()).product.id as number
}

async function financiamiento(api: APIRequestContext, enabled: boolean): Promise<void> {
  const r = await api.patch('/api/config/catalog', { data: { financing: { enabled, mode: 'cashea' } } })
  expect(r.status()).toBe(200)
}

/** Pedido del catálogo web (público): cada llamada con cédula, teléfono e IP distintos para no chocar con los topes. */
async function pedidoWeb(items: number[], extra: Record<string, unknown> = {}) {
  seq += 1
  return publico.post(`/api/catalog/${SLUG}/order`, {
    headers: { 'x-real-ip': `10.88.${Math.floor(seq / 250) % 250}.${(seq % 250) + 1}` },
    data: {
      items: items.map(id => ({ product_id: id, qty: 1 })),
      customer_name: `ZZ Cashea cliente ${seq}`, customer_phone: `0414${String(1000000 + (seq % 8999999))}`,
      customer_reference: 'Sector de prueba', payment_method: FIN_NAME, customer_cedula: `V-${20000000 + (seq % 9999999)}`,
      delivery_type: 'pickup', ...extra,
    },
  })
}

async function accion(api: APIRequestContext, kind: 'sales' | 'orders', id: number, action: string) {
  return api.patch(`/api/${kind}/${id}/financing`, { data: { action } })
}

const orderRow = (orderId: number): string =>
  sql(`SELECT CONCAT_WS('|', IFNULL(financing_status,'null'), IFNULL(financing_provider,'null'), IFNULL(financing_phrase,'null'), IFNULL(payment_kind,'null'), price_mode) FROM orders WHERE id=${orderId}`)
const orderIdOf = async (r: { json(): Promise<unknown> }): Promise<number> => (await r.json() as { order_id: number }).order_id
const finLog = (modelType: 'Sale' | 'Order', modelId: number): string[] =>
  sql(`SELECT CONCAT(user_id,'|',action,'|',IFNULL(JSON_UNQUOTE(JSON_EXTRACT(old_values,'$.financing_status')),'null'),'>',IFNULL(JSON_UNQUOTE(JSON_EXTRACT(new_values,'$.financing_status')),'null'))
       FROM activity_logs WHERE business_id=${BUSINESS_ID} AND action LIKE 'financing_%' AND model_type='${modelType}' AND model_id=${modelId} ORDER BY id`)
    .split('\n').map(l => l.trim()).filter(Boolean)

test.beforeAll(async () => {
  cleanup()
  publico = await pwRequest.newContext({ baseURL: BASE })
  const api = await apiAs()
  await financiamiento(api, true)
  ids.a = await crear(api, { name: 'ZZ Cashea A', cost_per_unit_usd: 40, price_per_unit_usd: 100, wholesale_price_usd: 80, stock_quantity: 50, show_in_catalog: true, catalog_visibility: 'visible' })
  ids.excluido = await crear(api, { name: 'ZZ Cashea Excluido', cost_per_unit_usd: 10, price_per_unit_usd: 30, stock_quantity: 50, show_in_catalog: true, catalog_visibility: 'visible', financing_excluded: true })
  sql(`INSERT INTO payment_methods (business_id, name, type, is_active, is_financing, sort_order) VALUES (${BUSINESS_ID}, '${FIN_NAME}', 'other', 1, 1, 99)`)
  ids.finMethod = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BUSINESS_ID} AND name='${FIN_NAME}'`))
  await api.dispose()
})
test.afterAll(async () => {
  await publico.dispose()
  sql(`UPDATE businesses SET settings = JSON_REMOVE(JSON_REMOVE(IFNULL(settings, JSON_OBJECT()), '$.financing'), '$.catalog_financing_badge') WHERE id = ${BUSINESS_ID}`)
  cleanup()
})

test('pedido web con Cashea válido: queda solicitado, con snapshot de proveedor y frase, a precio BCV', async () => {
  const r = await pedidoWeb([ids.a], { payment_kind: 'cashea' })
  expect(r.status(), JSON.stringify(await r.json().catch(() => ({})))).toBe(201)
  expect(orderRow(await orderIdOf(r))).toBe('requested|Cashea|Paga en cuotas con Cashea|cashea|bcv')
})

test('compatibilidad: sin payment_kind, un método financiador del checkout se toma como cashea', async () => {
  const r = await pedidoWeb([ids.a])
  expect(r.status()).toBe(201)
  expect(orderRow(await orderIdOf(r))).toBe('requested|Cashea|Paga en cuotas con Cashea|cashea|bcv')
})

test('pedido web con un producto excluido: 409 en español con el producto que lo impide y sin crear el pedido', async () => {
  const antes = Number(sql(`SELECT COUNT(*) FROM orders WHERE business_id=${BUSINESS_ID}`))
  const r = await pedidoWeb([ids.a, ids.excluido], { payment_kind: 'cashea' })
  expect(r.status()).toBe(409)
  const j = await r.json() as { error: string; field: string; blocked_products: Array<{ id: number; name: string }> }
  expect(j.error).toContain('"ZZ Cashea Excluido" no está disponible con financiamiento')
  expect(j.field).toBe('payment_kind')
  expect(j.blocked_products).toEqual([{ id: ids.excluido, name: 'ZZ Cashea Excluido' }])
  expect(Number(sql(`SELECT COUNT(*) FROM orders WHERE business_id=${BUSINESS_ID}`))).toBe(antes)
  // sin declarar Cashea el mismo carrito sí pasa (bs)
  expect((await pedidoWeb([ids.a, ids.excluido], { payment_kind: 'bs', payment_method: 'Efectivo Bs' })).status()).toBe(201)
})

test('pedido web con el financiamiento apagado: 409; bs y divisa solo guardan lo declarado y el pedido nace en BCV', async () => {
  const admin = await apiAs()
  await financiamiento(admin, false)
  const r = await pedidoWeb([ids.a], { payment_kind: 'cashea' })
  expect(r.status()).toBe(409)
  expect((await r.json()).error).toBe('Este negocio no tiene el financiamiento activo.')

  const bs = await pedidoWeb([ids.a], { payment_kind: 'bs', payment_method: 'Efectivo Bs' })
  expect(orderRow(await orderIdOf(bs))).toBe('null|null|null|bs|bcv')
  const divisa = await pedidoWeb([ids.a], { payment_kind: 'divisa', payment_method: 'Efectivo USD' })
  expect(orderRow(await orderIdOf(divisa))).toBe('null|null|null|divisa|bcv')
  await financiamiento(admin, true)
  await admin.dispose()
})

test('Cashea + Divisa se excluyen con 409 en los dos sentidos; rechazado libera', async () => {
  const api = await apiAs()
  const o = await api.post('/api/orders', { data: { origin: 'phone', client_name: 'ZZ Cashea excl', items: [{ product_id: ids.a, product_name: 'ZZ Cashea A', quantity: 1 }] } })
  const orderId = (await o.json()).order.id as number

  // Divisa activo → no se puede pedir financiamiento
  expect((await api.patch(`/api/orders/${orderId}/price-mode`, { data: { price_mode: 'divisa' } })).status()).toBe(200)
  const pedir = await accion(api, 'orders', orderId, 'request')
  expect(pedir.status()).toBe(409)
  expect((await pedir.json()).error).toContain('precio BCV completo')
  await api.patch(`/api/orders/${orderId}/price-mode`, { data: { price_mode: 'bcv' } })

  // Cashea pedido → no se puede pasar a Divisa
  expect((await accion(api, 'orders', orderId, 'request')).status()).toBe(200)
  const aDivisa = await api.patch(`/api/orders/${orderId}/price-mode`, { data: { price_mode: 'divisa' } })
  expect(aDivisa.status()).toBe(409)
  expect((await aDivisa.json()).error).toContain('Retira el financiamiento')
  expect(sql(`SELECT price_mode FROM orders WHERE id=${orderId}`)).toBe('bcv')

  // POS: financing + price_mode divisa explícito = 409
  const pos = await api.post('/api/sales', { data: { status: 'pending', origin: 'pos', price_mode: 'divisa', financing: 'cashea', items: [{ product_id: ids.a, quantity: 1, sale_mode: 'unit' }] } })
  expect(pos.status()).toBe(409)

  // rechazado libera: ya se puede pasar a Divisa
  expect((await accion(api, 'orders', orderId, 'reject')).status()).toBe(200)
  expect((await api.patch(`/api/orders/${orderId}/price-mode`, { data: { price_mode: 'divisa' } })).status()).toBe(200)
  await api.dispose()
})

test('estados: solicitado → aprobado → rechazado → solicitado → retirado, con bitácora de quién; transiciones inválidas 409', async () => {
  const api = await apiAs()
  const o = await api.post('/api/orders', { data: { origin: 'phone', client_name: 'ZZ Cashea estados', items: [{ product_id: ids.a, product_name: 'ZZ Cashea A', quantity: 1 }] } })
  const orderId = (await o.json()).order.id as number

  expect((await accion(api, 'orders', orderId, 'approve')).status()).toBe(409) // sin pedirlo antes
  const pedir = await accion(api, 'orders', orderId, 'request')
  const t = (await pedir.json()).ticket as Ticket
  expect(t.financing).toMatchObject({ status: 'requested', status_label: 'Solicitado', provider: 'Cashea' })
  expect((await accion(api, 'orders', orderId, 'request')).status()).toBe(200) // repetir no falla...
  expect(finLog('Order', orderId)).toHaveLength(1) // ...ni escribe otra fila

  expect(((await (await accion(api, 'orders', orderId, 'approve')).json()).ticket as Ticket).financing?.status).toBe('approved')
  expect((await accion(api, 'orders', orderId, 'request')).status()).toBe(409) // aprobado no se vuelve a pedir
  expect(((await (await accion(api, 'orders', orderId, 'reject')).json()).ticket as Ticket).financing?.status_label).toBe('Rechazado')
  expect((await accion(api, 'orders', orderId, 'approve')).status()).toBe(409) // rechazado no se aprueba directo
  expect(((await (await accion(api, 'orders', orderId, 'reopen')).json()).ticket as Ticket).financing?.status).toBe('requested')
  expect(((await (await accion(api, 'orders', orderId, 'clear')).json()).ticket as Ticket).financing).toBeNull()
  expect((await api.patch(`/api/orders/${orderId}/financing`, { data: { action: 'volar' } })).status()).toBe(400)

  expect(finLog('Order', orderId)).toEqual([
    '86|financing_requested|null>requested',
    '86|financing_status_changed|requested>approved',
    '86|financing_status_changed|approved>rejected',
    '86|financing_status_changed|rejected>requested',
    '86|financing_cleared|requested>null',
  ])
  await api.dispose()
})

test('cobro del pedido: bloqueado sin aprobar; aprobado solo con el método financiador (todo o nada); rechazado libera', async () => {
  const api = await apiAs()
  const r = await pedidoWeb([ids.a], { payment_kind: 'cashea' })
  const orderId = await orderIdOf(r)

  const sinAprobar = await api.post(`/api/orders/${orderId}/cobrar`, { data: { payment_method_id: ids.finMethod } })
  expect(sinAprobar.status()).toBe(409)
  expect((await sinAprobar.json()).error).toContain('todavía no está aprobado')
  const otroMetodo = await api.post(`/api/orders/${orderId}/cobrar`, { data: { payment_method_id: CASH_ID } })
  expect(otroMetodo.status()).toBe(409)
  expect((await otroMetodo.json()).error).toContain('apruébalo, recházalo o retíralo')

  await accion(api, 'orders', orderId, 'approve')
  const mezcla = await api.post(`/api/orders/${orderId}/cobrar`, { data: { payment_method_id: CASH_ID } })
  expect(mezcla.status()).toBe(409)
  expect((await mezcla.json()).error).toContain('todo o nada')
  const divisa = await api.post(`/api/orders/${orderId}/cobrar`, { data: { payment_method_id: ids.finMethod, price_mode: 'divisa' } })
  expect(divisa.status()).toBe(409) // Cashea nunca se cobra en Divisa

  const ok = await api.post(`/api/orders/${orderId}/cobrar`, { data: { payment_method_id: ids.finMethod, reference: 'CASH-123', cedula: 'V-12345678' } })
  expect(ok.status(), JSON.stringify(await ok.json().catch(() => ({})))).toBe(200)
  const saleId = (await ok.json()).sale_id as number
  expect(sql(`SELECT CONCAT_WS('|', status, price_mode, financing_status, financing_provider, total_usd) FROM sales WHERE id=${saleId}`)).toBe('paid|bcv|approved|Cashea|100.00')
  const tarde = await accion(api, 'orders', orderId, 'clear')
  expect(tarde.status()).toBe(409)
  expect((await tarde.json()).error).toContain('ya fue cobrado')

  // rechazado: libera para cobrar con otro método y bloquea el financiador
  const r2 = await pedidoWeb([ids.a], { payment_kind: 'cashea' })
  const orderId2 = await orderIdOf(r2)
  await accion(api, 'orders', orderId2, 'reject')
  expect((await api.post(`/api/orders/${orderId2}/cobrar`, { data: { payment_method_id: ids.finMethod } })).status()).toBe(409)
  expect((await api.post(`/api/orders/${orderId2}/cobrar`, { data: { payment_method_id: CASH_ID } })).status()).toBe(200)
  await api.dispose()
})

test('POS: mismo resultado — declarar, no cobrar sin aprobar, todo o nada y el stock baja SOLO al pagar', async () => {
  const api = await apiAs()
  const item = [{ product_id: ids.a, quantity: 2, sale_mode: 'unit' }]
  const antes = netStock(ids.a)

  const v = await api.post('/api/sales', { data: { status: 'pending', origin: 'pos', financing: 'cashea', items: item } })
  expect(v.status(), JSON.stringify(await v.json().catch(() => ({})))).toBe(201)
  const sale = (await v.json()).sale as SaleResp
  expect(sale).toMatchObject({ price_mode: 'bcv', financing_status: 'requested' })
  expect(finLog('Sale', sale.id)).toEqual(['86|financing_requested|null>requested'])
  const totalBs = Number(sql(`SELECT total_bs FROM sales WHERE id=${sale.id}`))
  const pagoFin = [{ payment_method_id: ids.finMethod, amount_bs: totalBs, amount_usd: Number(sale.total_usd), reference: 'CASH-9' }]
  const pagoCash = [{ payment_method_id: CASH_ID, amount_bs: totalBs, amount_usd: Number(sale.total_usd) }]

  const sinAprobar = await api.patch(`/api/sales/${sale.id}/pay`, { data: { payments: pagoFin, client_cedula: 'V-12345678' } })
  expect(sinAprobar.status()).toBe(409)
  expect((await sinAprobar.json()).error).toContain('todavía no está aprobado')
  expect((await api.patch(`/api/sales/${sale.id}/pay`, { data: { payments: pagoCash } })).status()).toBe(409)
  expect(netStock(ids.a)).toBe(antes) // ni declarar ni aprobar mueven stock

  expect((await accion(api, 'sales', sale.id, 'approve')).status()).toBe(200)
  expect(netStock(ids.a)).toBe(antes)
  expect((await api.patch(`/api/sales/${sale.id}/pay`, { data: { payments: pagoCash } })).status()).toBe(409) // no mezcla
  const pay = await api.patch(`/api/sales/${sale.id}/pay`, { data: { payments: pagoFin, client_cedula: 'V-12345678' } })
  expect(pay.status(), JSON.stringify(await pay.json().catch(() => ({})))).toBe(200)
  expect(netStock(ids.a)).toBe(antes - 2) // baja SOLO al pagar
  expect(sql(`SELECT CONCAT_WS('|', status, price_mode, financing_status) FROM sales WHERE id=${sale.id}`)).toBe('paid|bcv|approved')

  // cobro directo con el método financiador sin declarar nada: bloqueado
  const directo = await api.post('/api/sales', { data: { status: 'paid', origin: 'pos', items: item, client_cedula: 'V-12345678', payments: [{ payment_method_id: ids.finMethod, amount_bs: 9_000_000, amount_usd: 10_000 }] } })
  expect(directo.status()).toBe(409)
  expect((await directo.json()).error).toContain('declara el financiamiento')
  expect(netStock(ids.a)).toBe(antes - 2)

  // producto excluido en el POS: 409 con el producto; financing solo con pending
  const excl = await api.post('/api/sales', { data: { status: 'pending', origin: 'pos', financing: 'cashea', items: [{ product_id: ids.excluido, quantity: 1, sale_mode: 'unit' }] } })
  expect(excl.status()).toBe(409)
  expect((await excl.json()).blocked_products).toEqual([{ id: ids.excluido, name: 'ZZ Cashea Excluido' }])
  const pagada = await api.post('/api/sales', { data: { status: 'paid', origin: 'pos', financing: 'cashea', items: item, payments: pagoCash } })
  expect(pagada.status()).toBe(400)
  await api.dispose()
})

test('cambiar los ítems con financiamiento vivo: producto excluido 409; un aprobado vuelve a solicitado (pedido y borrador)', async () => {
  const api = await apiAs()

  // Pedido aprobado: meter un producto excluido se rechaza y no toca el estado
  const o = await api.post('/api/orders', { data: { origin: 'phone', client_name: 'ZZ Cashea items', items: [{ product_id: ids.a, product_name: 'ZZ Cashea A', quantity: 1 }] } })
  const orderId = (await o.json()).order.id as number
  await accion(api, 'orders', orderId, 'request')
  await accion(api, 'orders', orderId, 'approve')
  const malo = await api.patch(`/api/orders/${orderId}/items`, { data: { items: [{ product_id: ids.excluido, product_name: 'ZZ Cashea Excluido', quantity: 1 }] } })
  expect(malo.status()).toBe(409)
  expect((await malo.json()).blocked_products).toEqual([{ id: ids.excluido, name: 'ZZ Cashea Excluido' }])
  expect(sql(`SELECT financing_status FROM orders WHERE id=${orderId}`)).toBe('approved')
  // Cambio válido: el monto cambió, así que la aprobación se pierde y queda en bitácora
  const bien = await api.patch(`/api/orders/${orderId}/items`, { data: { items: [{ product_id: ids.a, product_name: 'ZZ Cashea A', quantity: 2 }] } })
  expect(bien.status()).toBe(200)
  expect(sql(`SELECT CONCAT(financing_status,'|',total_usd) FROM orders WHERE id=${orderId}`)).toBe('requested|200.00')
  expect(finLog('Order', orderId).slice(-1)).toEqual(['86|financing_status_changed|approved>requested'])
  // y ya no se puede cobrar hasta aprobar de nuevo
  expect((await api.post(`/api/orders/${orderId}/cobrar`, { data: { payment_method_id: ids.finMethod } })).status()).toBe(409)

  // Borrador del POS: mismo comportamiento
  const d = await api.post('/api/pos/drafts', { data: { items: [{ product_id: ids.a, quantity: 1 }] } })
  const draftId = (await d.json()).draft.id as number
  await accion(api, 'sales', draftId, 'request')
  await accion(api, 'sales', draftId, 'approve')
  const dMalo = await api.patch(`/api/pos/drafts/${draftId}`, { data: { items: [{ product_id: ids.excluido, quantity: 1 }] } })
  expect(dMalo.status()).toBe(409)
  expect((await dMalo.json()).blocked_products).toEqual([{ id: ids.excluido, name: 'ZZ Cashea Excluido' }])
  const dDivisa = await api.patch(`/api/pos/drafts/${draftId}`, { data: { items: [{ product_id: ids.a, quantity: 1 }], price_mode: 'divisa' } })
  expect(dDivisa.status()).toBe(409)
  expect(sql(`SELECT financing_status FROM sales WHERE id=${draftId}`)).toBe('approved')
  const dBien = await api.patch(`/api/pos/drafts/${draftId}`, { data: { items: [{ product_id: ids.a, quantity: 3 }] } })
  expect(dBien.status()).toBe(200)
  expect(sql(`SELECT financing_status FROM sales WHERE id=${draftId}`)).toBe('requested')
  await api.dispose()
})

test('defensa al cobrar: un ticket aprobado cuyo producto pasó a excluido ya no se cobra como financiado', async () => {
  const api = await apiAs()
  const extra = await crear(api, { name: 'ZZ Cashea Luego Excluido', cost_per_unit_usd: 10, price_per_unit_usd: 20, stock_quantity: 10 })
  const o = await api.post('/api/orders', { data: { origin: 'phone', client_name: 'ZZ Cashea defensa', items: [{ product_id: extra, product_name: 'ZZ Cashea Luego Excluido', quantity: 1 }] } })
  const orderId = (await o.json()).order.id as number
  await accion(api, 'orders', orderId, 'request')
  await accion(api, 'orders', orderId, 'approve')
  expect((await api.patch(`/api/products/${extra}`, { data: { financing_excluded: true } })).status()).toBe(200)
  const r = await api.post(`/api/orders/${orderId}/cobrar`, { data: { payment_method_id: ids.finMethod, cedula: 'V-12345678' } })
  expect(r.status()).toBe(409)
  expect((await r.json()).error).toContain('no está disponible con financiamiento')
  expect(sql(`SELECT sale_id IS NULL FROM orders WHERE id=${orderId}`)).toBe('1')
  await api.dispose()
})

test('borrador con cliente asignado: el cobro Cashea por el borrador conserva client_id (y uno de otro negocio se rechaza)', async () => {
  const api = await apiAs()
  const c = await api.post('/api/clients', { data: { name: 'ZZ Cashea cliente asignado', phone: '04125550177' } })
  expect(c.status(), JSON.stringify(await c.json().catch(() => ({})))).toBe(201)
  const clientId = (await c.json()).client.id as number
  const item = [{ product_id: ids.a, quantity: 1 }]

  // el cliente viaja al crear el borrador y también al editarlo
  const d = await api.post('/api/pos/drafts', { data: { items: item, client_id: clientId } })
  expect(d.status(), JSON.stringify(await d.json().catch(() => ({})))).toBe(201)
  const draftId = (await d.json()).draft.id as number
  expect(sql(`SELECT IFNULL(client_id,'null') FROM sales WHERE id=${draftId}`)).toBe(String(clientId))
  const p = await api.patch(`/api/pos/drafts/${draftId}`, { data: { items: [{ product_id: ids.a, quantity: 2 }], client_id: clientId } })
  expect(p.status()).toBe(200)
  // un PATCH sin client_id NO borra al cliente
  expect((await api.patch(`/api/pos/drafts/${draftId}`, { data: { items: [{ product_id: ids.a, quantity: 2 }] } })).status()).toBe(200)
  expect(sql(`SELECT client_id FROM sales WHERE id=${draftId}`)).toBe(String(clientId))

  await accion(api, 'sales', draftId, 'request')
  await accion(api, 'sales', draftId, 'approve')
  const totalBs = Number(sql(`SELECT total_bs FROM sales WHERE id=${draftId}`))
  const totalUsd = Number(sql(`SELECT total_usd FROM sales WHERE id=${draftId}`))
  const pay = await api.patch(`/api/sales/${draftId}/pay`, { data: { payments: [{ payment_method_id: ids.finMethod, amount_bs: totalBs, amount_usd: totalUsd }], client_cedula: 'V-12345678' } })
  expect(pay.status(), JSON.stringify(await pay.json().catch(() => ({})))).toBe(200)
  expect(sql(`SELECT CONCAT_WS('|', status, client_id, financing_status) FROM sales WHERE id=${draftId}`)).toBe(`paid|${clientId}|approved`)

  // cliente de otro negocio: 400 y el borrador no queda colgado de él
  const ajeno = Number(sql(`SELECT id FROM clients WHERE business_id<>${BUSINESS_ID} LIMIT 1`))
  if (ajeno) {
    const mal = await api.post('/api/pos/drafts', { data: { items: item, client_id: ajeno } })
    expect(mal.status()).toBe(400)
    expect((await mal.json()).error).toBe('Cliente no encontrado')
  }
  await api.dispose()
})

test('descuento con PIN sobre un ticket aprobado: vuelve a solicitado (con motivo) y cobrar da 409 hasta aprobar de nuevo', async () => {
  const api = await apiAs()
  // PIN de autorización = contraseña (bcrypt) de un usuario activo del negocio: se crea un admin temporal con PIN conocido.
  const PIN = 'ZZ-Pin-4821'
  sql(`INSERT INTO users (business_id, name, email, password, role, is_active, updated_at) VALUES (${BUSINESS_ID}, 'ZZ Cashea Admin PIN', '${PIN_EMAIL}', '${await bcrypt.hash(PIN, 4)}', 'admin', 1, NOW(3))`)

  const v = await api.post('/api/sales', { data: { status: 'pending', origin: 'pos', financing: 'cashea', items: [{ product_id: ids.a, quantity: 2, sale_mode: 'unit' }] } })
  const sale = (await v.json()).sale as SaleResp
  await accion(api, 'sales', sale.id, 'approve')
  expect(sql(`SELECT financing_status FROM sales WHERE id=${sale.id}`)).toBe('approved')

  const d = await api.post(`/api/sales/${sale.id}/authorize-discount`, { data: { pin: PIN, discount_pct: 10 } })
  expect(d.status(), JSON.stringify(await d.json().catch(() => ({})))).toBe(200)
  expect(sql(`SELECT CONCAT_WS('|', financing_status, total_usd) FROM sales WHERE id=${sale.id}`)).toBe('requested|180.00')
  const log = sql(`SELECT CONCAT(user_id,'|',IFNULL(reason,'')) FROM activity_logs WHERE business_id=${BUSINESS_ID} AND model_type='Sale' AND model_id=${sale.id} AND action='financing_status_changed' ORDER BY id DESC LIMIT 1`)
  expect(log).toBe('86|Se aplicó un descuento: el monto debe aprobarse de nuevo')

  const totalBs = Number(sql(`SELECT total_bs FROM sales WHERE id=${sale.id}`))
  const pagoFin = [{ payment_method_id: ids.finMethod, amount_bs: totalBs, amount_usd: 180 }]
  const sinAprobar = await api.patch(`/api/sales/${sale.id}/pay`, { data: { payments: pagoFin, client_cedula: 'V-12345678' } })
  expect(sinAprobar.status()).toBe(409)
  await accion(api, 'sales', sale.id, 'approve')
  expect((await api.patch(`/api/sales/${sale.id}/pay`, { data: { payments: pagoFin, client_cedula: 'V-12345678' } })).status()).toBe(200)

  // un descuento sobre un ticket SIN financiamiento sigue funcionando igual
  const normal = (await (await api.post('/api/sales', { data: { status: 'pending', origin: 'pos', items: [{ product_id: ids.a, quantity: 1, sale_mode: 'unit' }] } })).json()).sale as SaleResp
  const dn = await api.post(`/api/sales/${normal.id}/authorize-discount`, { data: { pin: PIN, discount_pct: 10 } })
  expect(dn.status()).toBe(200)
  expect(sql(`SELECT CONCAT_WS('|', IFNULL(financing_status,'null'), total_usd) FROM sales WHERE id=${normal.id}`)).toBe('null|90.00')
  await api.dispose()
})

test('configurar un método: type cash + is_financing se rechaza (400); uno de otro tipo sí puede ser financiador', async () => {
  const api = await apiAs()
  const cash = await api.patch(`/api/config/payment-methods/${CASH_ID}`, { data: { is_financing: true } })
  expect(cash.status()).toBe(400)
  expect((await cash.json()).error).toContain('efectivo no puede ser financiador')
  expect(sql(`SELECT is_financing FROM payment_methods WHERE id=${CASH_ID}`)).toBe('0')
  expect((await api.patch(`/api/config/payment-methods/${ids.finMethod}`, { data: { is_financing: true } })).status()).toBe(200)
  await api.dispose()
})

test('cobro con un método inexistente o de otro negocio mezclado: falla y la venta sigue pendiente (nunca se ignora)', async () => {
  const api = await apiAs()
  const v = await api.post('/api/sales', { data: { status: 'pending', origin: 'pos', items: [{ product_id: ids.a, quantity: 1, sale_mode: 'unit' }] } })
  const sale = (await v.json()).sale as SaleResp
  const totalBs = Number(sql(`SELECT total_bs FROM sales WHERE id=${sale.id}`))
  const mezcla = [
    { payment_method_id: CASH_ID, amount_bs: totalBs, amount_usd: Number(sale.total_usd) },
    { payment_method_id: 999999999, amount_bs: 1, amount_usd: 1 },
  ]
  const r = await api.patch(`/api/sales/${sale.id}/pay`, { data: { payments: mezcla } })
  expect([403, 409]).toContain(r.status()) // 403 por el chequeo de tenant del pay, 409 por el del financiamiento: nunca 200
  expect(sql(`SELECT status FROM sales WHERE id=${sale.id}`)).toBe('pending')
  await api.dispose()
})

test('cajero: solo opera el financiamiento de SUS ventas; el admin cualquiera', async () => {
  const admin = await apiAs()
  const cajero = await apiRole(CASHIER_ID, 'cashier')
  const ajena = (await (await admin.post('/api/sales', { data: { status: 'pending', origin: 'pos', items: [{ product_id: ids.a, quantity: 1, sale_mode: 'unit' }] } })).json()).sale as SaleResp
  expect((await accion(cajero, 'sales', ajena.id, 'request')).status()).toBe(404)
  expect((await accion(admin, 'sales', ajena.id, 'request')).status()).toBe(200)
  const propia = ((await (await cajero.post('/api/sales', { data: { status: 'pending', origin: 'pos', items: [{ product_id: ids.a, quantity: 1, sale_mode: 'unit' }] } })).json()) as { sale: SaleResp }).sale
  expect((await accion(cajero, 'sales', propia.id, 'request')).status()).toBe(200)
  expect(finLog('Sale', propia.id)).toEqual([`${CASHIER_ID}|financing_requested|null>requested`])
  await cajero.dispose()
  await admin.dispose()
})

test('reportes y caja: Cashea se segmenta y no se mezcla con el resto', async () => {
  const api = await apiAs()
  const conFin = await (await api.get('/api/sales?financing=cashea&limit=100')).json() as { sales: Array<{ financing_status: string | null }> }
  expect(conFin.sales.length).toBeGreaterThan(0)
  expect(conFin.sales.every(s => s.financing_status !== null)).toBe(true)
  const sinFin = await (await api.get('/api/sales?financing=none&limit=100')).json() as { sales: Array<{ financing_status: string | null }> }
  expect(sinFin.sales.every(s => s.financing_status === null)).toBe(true)
  const rep = await (await api.get('/api/reports/sales?financing=cashea&limit=50')).json() as { sales: Array<{ financing_status: string | null }> }
  expect(rep.sales.every(s => s.financing_status !== null)).toBe(true)

  const hoy = new Date().toISOString().slice(0, 10)
  const day = await (await api.get(`/api/reports/day?date=${hoy}`)).json() as { payment_methods: Array<{ method: string; is_financing: boolean; total_usd: number }>; summary_financing: { usd: number; count: number } }
  const fin = day.payment_methods.find(m => m.method === FIN_NAME)
  expect(fin?.is_financing).toBe(true)
  expect(day.summary_financing.usd).toBeGreaterThanOrEqual(fin?.total_usd ?? 0)
  expect(day.summary_financing.count).toBeGreaterThan(0)

  const caja = await (await api.get('/api/cash/status')).json() as { isOpen: boolean; turnoStats?: { financiamiento: { usd: number; bs: number }; efectivoEsperado: number } }
  if (caja.isOpen) expect(caja.turnoStats?.financiamiento.usd).toBeGreaterThanOrEqual(0)
  await api.dispose()
})
