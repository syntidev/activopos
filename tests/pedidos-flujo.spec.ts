import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Pedidos: el pago está desacoplado de la etapa, Cashea es un REGISTRO (inicial + saldo asignado) y las etapas se guardan con el
 * estado de pago derivado. Negocio de pruebas propio (ZZA, E2E_BUSINESS_ID); de otros negocios solo se LEE un id de cliente.
 * Servidor local en :3001.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const { businessId: BID, adminId: ADMIN } = ownBusiness()
const TAG = String(Date.now()).slice(-6)
const PREFIJO = 'ZZA Ped'
const PRODUCTO = `${PREFIJO} Producto ${TAG}`
const M_EFECTIVO = `${PREFIJO} Efectivo`
const M_CASHEA = `${PREFIJO} Cashea`
const CEDULA = 'V12345678'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let admin: APIRequestContext
let cajero: APIRequestContext
let productId = 0
let clienteId = 0
let ajeno = 0
let efectivoId = 0
let casheaId = 0
let financingOriginal = 'NULL'
const ventasExtra: number[] = []

const token = (role: string) =>
  new SignJWT({ userId: ADMIN, businessId: BID, role, name: 'ZZA Pedidos' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
const ctx = async (role: string) => pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token(role)}` } })

function limpiar(): void {
  const ordenes = sql(`SELECT id FROM orders WHERE business_id=${BID} AND client_name LIKE '${PREFIJO} %'`).split(/\r?\n/).map(s => s.trim()).filter(Boolean).join(',')
  const ventas = [
    ...sql(`SELECT sale_id FROM orders WHERE business_id=${BID} AND client_name LIKE '${PREFIJO} %' AND sale_id IS NOT NULL`).split(/\r?\n/).map(s => s.trim()).filter(Boolean),
    ...ventasExtra.map(String),
  ].join(',')
  if (ordenes) {
    sql(`DELETE FROM activity_logs WHERE business_id=${BID} AND model_type='Order' AND model_id IN (${ordenes})`)
    sql(`DELETE FROM order_items WHERE order_id IN (${ordenes})`)
    sql(`DELETE FROM orders WHERE id IN (${ordenes})`)
  }
  if (ventas) {
    sql(`DELETE FROM activity_logs WHERE business_id=${BID} AND model_type='Sale' AND model_id IN (${ventas})`)
    sql(`DELETE FROM sale_payments WHERE sale_id IN (${ventas})`)
    sql(`DELETE FROM sale_abonos WHERE sale_id IN (${ventas})`)
    sql(`DELETE FROM sale_items WHERE sale_id IN (${ventas})`)
    sql(`DELETE FROM sales WHERE business_id=${BID} AND id IN (${ventas})`)
  }
  sql(`DELETE FROM inventory_entries WHERE business_id=${BID} AND product_id IN (SELECT id FROM products WHERE business_id=${BID} AND name LIKE '${PREFIJO} Producto%')`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND name LIKE '${PREFIJO} Producto%'`)
  sql(`DELETE FROM clients WHERE business_id=${BID} AND name LIKE '${PREFIJO} %'`)
  sql(`DELETE FROM payment_methods WHERE business_id=${BID} AND name LIKE '${PREFIJO} %'`)
}

test.beforeAll(async () => {
  financingOriginal = sql(`SELECT IFNULL(JSON_EXTRACT(settings,'$.financing'),'NULL') FROM businesses WHERE id=${BID}`)
  limpiar()
  // financiamiento activo en el negocio de pruebas (se restaura al final)
  sql(`UPDATE businesses SET settings=JSON_SET(COALESCE(settings,JSON_OBJECT()),'$.financing',JSON_OBJECT('enabled',true,'mode','cashea','provider_name','Cashea','phrase','Paga en cuotas con Cashea')) WHERE id=${BID}`)
  sql(`INSERT INTO payment_methods (business_id,name,type,sort_order,is_active,is_financing) VALUES (${BID},'${M_EFECTIVO}','cash',-30,1,0),(${BID},'${M_CASHEA}','other',-29,1,1)`)
  efectivoId = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BID} AND name='${M_EFECTIVO}'`))
  casheaId = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BID} AND name='${M_CASHEA}'`))
  sql(`INSERT INTO products (business_id,name,images,price_per_unit_usd,sale_mode,product_type,active,available_in_pos,show_in_catalog,catalog_visibility,is_available,availability,updated_at)
       VALUES (${BID},'${PRODUCTO}','[]',100,'service','simple',1,1,0,'visible',1,'in_stock',NOW(3))`)
  productId = Number(sql(`SELECT id FROM products WHERE business_id=${BID} AND name='${PRODUCTO}'`))
  sql(`INSERT INTO clients (business_id,name,phone,cedula,address,price_tier,is_active,origin,created_at,updated_at) VALUES (${BID},'${PREFIJO} Cliente ${TAG}','04140000000','${CEDULA}','Calle de prueba 1','detal',1,'pos',NOW(3),NOW(3))`)
  clienteId = Number(sql(`SELECT id FROM clients WHERE business_id=${BID} AND name='${PREFIJO} Cliente ${TAG}'`))
  ajeno = Number(sql(`SELECT id FROM clients WHERE business_id<>${BID} ORDER BY id LIMIT 1`)) // solo lectura: cliente de OTRO negocio
  admin = await ctx('admin')
  cajero = await ctx('cashier')
})

test.afterAll(async () => {
  limpiar()
  sql(financingOriginal === 'NULL'
    ? `UPDATE businesses SET settings=JSON_REMOVE(settings,'$.financing') WHERE id=${BID} AND settings IS NOT NULL`
    : `UPDATE businesses SET settings=JSON_SET(settings,'$.financing',CAST('${financingOriginal}' AS JSON)) WHERE id=${BID}`)
  await admin?.dispose()
  await cajero?.dispose()
})

async function pedido(conCliente = true): Promise<number> {
  const r = await admin.post('/api/orders', {
    data: {
      origin: 'whatsapp', client_name: `${PREFIJO} Cliente ${TAG}`, ...(conCliente ? { client_id: clienteId } : {}),
      items: [{ product_id: productId, product_name: PRODUCTO, quantity: 1 }],
    },
  })
  expect(r.status(), await r.text()).toBeLessThan(300)
  return ((await r.json()) as { order: { id: number } }).order.id
}
const detalle = async (id: number) => ((await (await admin.get(`/api/orders/${id}`)).json()) as { order: Record<string, any> }).order // eslint-disable-line @typescript-eslint/no-explicit-any
const estado = (id: number): string => sql(`SELECT status FROM orders WHERE id=${id}`)
const pagos = (id: number): string[] => sql(`SELECT CONCAT(pm.name,':',sp.amount_usd) FROM sale_payments sp JOIN payment_methods pm ON pm.id=sp.payment_method_id WHERE sp.sale_id=(SELECT sale_id FROM orders WHERE id=${id}) ORDER BY sp.id`).split(/\r?\n/).map(s => s.trim()).filter(Boolean)
const mover = async (id: number, status: string, extra: object = {}) => admin.patch(`/api/orders/${id}`, { data: { status, ...extra } })
const cobrar = (id: number, data: object) => admin.post(`/api/orders/${id}/cobrar`, { data })

test('cobrar en "received" NO cambia la etapa: el pedido queda cobrado y sigue en su cola', async () => {
  const id = await pedido()
  expect((await detalle(id)).pago_estado).toBe('por_cobrar')
  const r = await cobrar(id, { payment_method_id: efectivoId })
  expect(r.status(), await r.text()).toBe(200)
  expect(estado(id), 'la etapa no se toca').toBe('received')
  const d = await detalle(id)
  expect(d.pago_estado).toBe('cobrado')
  expect(d.pago).toMatchObject({ total_usd: 100, recibido_usd: 100, cashea_asignado_usd: 0, deuda_cliente_usd: 0, saldo_pendiente_usd: 0 })
  expect(pagos(id)).toEqual([`${M_EFECTIVO}:100.00`])
  expect(sql(`SELECT IFNULL(financing_status,'NULL') FROM sales WHERE id=(SELECT sale_id FROM orders WHERE id=${id})`), 'un cobro normal no lleva financiamiento').toBe('NULL')
  // ya cobrado: el listado también lo dice y un segundo cobro responde 409
  const lista = (await (await admin.get('/api/orders?limit=100')).json()) as { orders: Array<{ id: number; pago_estado: string }> }
  expect(lista.orders.find(o => o.id === id)?.pago_estado).toBe('cobrado')
  expect((await cobrar(id, { payment_method_id: efectivoId })).status()).toBe(409)
})

let conCashea = 0

test('Cashea "requested" ya no bloquea: cobrar registra la inicial (método real) y el saldo asignado a Cashea', async () => {
  conCashea = await pedido()
  const pedida = await admin.patch(`/api/orders/${conCashea}/financing`, { data: { action: 'request' } })
  expect(pedida.status(), await pedida.text()).toBe(200)
  expect(sql(`SELECT financing_status FROM orders WHERE id=${conCashea}`)).toBe('requested')

  // la cédula del financiador se sigue exigiendo
  const sinCedula = await cobrar(conCashea, { payment_method_id: casheaId, initial: { payment_method_id: efectivoId, amount_usd: 40 }, cedula: 'abc' })
  expect(sinCedula.status()).toBe(422)
  expect((await sinCedula.json()).field).toBe('cedula')
  // la inicial no puede cubrir el total, ni usar el financiador, ni acompañar a un método normal
  for (const [nombre, data] of [
    ['inicial = total', { payment_method_id: casheaId, initial: { payment_method_id: efectivoId, amount_usd: 100 }, cedula: CEDULA }],
    ['inicial con el financiador', { payment_method_id: casheaId, initial: { payment_method_id: casheaId, amount_usd: 40 }, cedula: CEDULA }],
    ['inicial con método normal', { payment_method_id: efectivoId, initial: { payment_method_id: efectivoId, amount_usd: 40 } }],
  ] as const) {
    const r = await cobrar(conCashea, data)
    expect(r.status(), `${nombre}: ${await r.text()}`).toBe(422)
    expect((await r.json()).field, nombre).toBe('initial')
  }
  expect(sql(`SELECT IFNULL(sale_id,'NULL') FROM orders WHERE id=${conCashea}`), 'nada se cobró con los intentos inválidos').toBe('NULL')

  const r = await cobrar(conCashea, { payment_method_id: casheaId, initial: { payment_method_id: efectivoId, amount_usd: 40, reference: 'REF-1' }, cedula: CEDULA })
  expect(r.status(), await r.text()).toBe(200)
  expect(estado(conCashea), 'etapa intacta').toBe('received')
  expect(pagos(conCashea)).toEqual([`${M_EFECTIVO}:40.00`, `${M_CASHEA}:60.00`]) // inicial real + saldo a Cashea
  const d = await detalle(conCashea)
  expect(d.pago_estado, 'el saldo asignado a Cashea cuenta como cobrado').toBe('cobrado')
  expect(d.pago).toMatchObject({ total_usd: 100, recibido_usd: 40, cashea_asignado_usd: 60, deuda_cliente_usd: 0, saldo_pendiente_usd: 0, puede_avanzar: true })
  expect(sql(`SELECT financing_status FROM orders WHERE id=${conCashea}`), 'cobrar con el financiador deja el financiamiento aprobado (registro)').toBe('approved')
  expect(sql(`SELECT financing_status FROM sales WHERE id=(SELECT sale_id FROM orders WHERE id=${conCashea})`)).toBe('approved')
  // la inicial entra a la caja por su método; el saldo de Cashea queda aparte (línea con método financiador)
  expect(Number(sql(`SELECT COUNT(*) FROM sale_payments sp JOIN payment_methods pm ON pm.id=sp.payment_method_id WHERE sp.sale_id=(SELECT sale_id FROM orders WHERE id=${conCashea}) AND pm.is_financing=1`))).toBe(1)
})

test('rechazar Cashea DESPUÉS de cobrar: el saldo asignado pasa a deuda del cliente y no bloquea etapas', async () => {
  const antes = await detalle(conCashea)
  expect(antes.client.deuda_financiamiento_usd).toBe(0)
  const r = await admin.patch(`/api/orders/${conCashea}/financing`, { data: { action: 'reject' } })
  expect(r.status(), await r.text()).toBe(200)
  expect(sql(`SELECT financing_status FROM orders WHERE id=${conCashea}`)).toBe('rejected')
  expect(sql(`SELECT financing_status FROM sales WHERE id=(SELECT sale_id FROM orders WHERE id=${conCashea})`)).toBe('rejected')

  const d = await detalle(conCashea)
  expect(d.pago_estado, 'saldo de Cashea → por cobrar').toBe('por_cobrar')
  expect(d.pago).toMatchObject({ recibido_usd: 40, cashea_asignado_usd: 0, deuda_cliente_usd: 60, saldo_pendiente_usd: 60, puede_avanzar: true })
  expect(d.client).toMatchObject({ deuda_financiamiento_usd: 60, saldo_cxc_usd: 0, saldo_por_cobrar_usd: 60 })
  expect(Number(sql(`SELECT COUNT(*) FROM activity_logs WHERE business_id=${BID} AND model_type='Order' AND model_id=${conCashea} AND reason LIKE 'Rechazado después de cobrar%'`)), 'queda en la bitácora').toBe(1)
  // sin bloquear etapas: el pedido avanza hasta despachado sin override ni nuevo cobro
  for (const e of ['preparing', 'ready', 'dispatched']) expect((await mover(conCashea, e)).status(), e).toBe(200)
  expect(estado(conCashea)).toBe('dispatched')
  // sobre un pedido cobrado sin línea financiadora no se puede cambiar el financiamiento
  const normal = await pedido()
  expect((await cobrar(normal, { payment_method_id: efectivoId })).status()).toBe(200)
  expect((await admin.patch(`/api/orders/${normal}/financing`, { data: { action: 'reject' } })).status()).toBe(409)
})

test('despachar sin cobrar → 422; override de administrador con motivo → ok y queda registrado; entregar sin cobrar → 422', async () => {
  const id = await pedido()
  for (const e of ['preparing', 'ready']) expect((await mover(id, e)).status(), `${e} no tiene guarda`).toBe(200)

  const sin = await mover(id, 'dispatched')
  expect(sin.status()).toBe(422)
  expect(await sin.json()).toMatchObject({ field: 'payment', code: 'PAYMENT_REQUIRED', pago_estado: 'por_cobrar' })
  expect(estado(id)).toBe('ready')

  // un cajero no puede autorizar el despacho sin cobro
  const cajeroIntenta = await cajero.patch(`/api/orders/${id}`, { data: { status: 'dispatched', override_reason: 'Cliente de confianza' } })
  expect(cajeroIntenta.status()).toBe(403)
  expect((await cajeroIntenta.json()).field).toBe('override_reason')
  // motivo demasiado corto: datos inválidos
  expect((await mover(id, 'dispatched', { override_reason: 'x' })).status()).toBe(400)

  const ok = await mover(id, 'dispatched', { override_reason: 'Cliente frecuente, paga mañana' })
  expect(ok.status(), await ok.text()).toBe(200)
  expect((await ok.json()).override).toBe(true)
  expect(estado(id)).toBe('dispatched')
  expect(sql(`SELECT reason FROM activity_logs WHERE business_id=${BID} AND model_type='Order' AND model_id=${id} AND action='order_dispatch_override'`)).toBe('Cliente frecuente, paga mañana')

  // entregar sin cobrar ni crédito → 422 (el override NO aplica a la entrega)
  const entrega = await mover(id, 'delivered', { override_reason: 'Cliente frecuente, paga mañana' })
  expect(entrega.status()).toBe(422)
  expect(await entrega.json()).toMatchObject({ field: 'payment', code: 'PAYMENT_REQUIRED' })
  expect(estado(id)).toBe('dispatched')

  // cobrar un pedido ya despachado lo entrega
  expect((await cobrar(id, { payment_method_id: efectivoId })).status()).toBe(200)
  expect(estado(id), 'dispatched + cobro → delivered').toBe('delivered')
})

test('a crédito (venta "credit" enlazada) y cobrado dejan despachar y entregar sin override', async () => {
  const id = await pedido()
  for (const e of ['preparing', 'ready']) expect((await mover(id, e)).status()).toBe(200)
  const venta = await admin.post('/api/sales', {
    data: { items: [{ product_id: productId, quantity: 1, sale_mode: 'service', price_per_unit_usd: 100 }], status: 'credit', origin: 'credit', client_id: clienteId },
  })
  expect(venta.status(), await venta.text()).toBeLessThan(300)
  const ventaId = Number(sql(`SELECT MAX(id) FROM sales WHERE business_id=${BID} AND client_id=${clienteId} AND status='credit'`))
  ventasExtra.push(ventaId)
  sql(`UPDATE orders SET sale_id=${ventaId} WHERE id=${id}`) // el cierre a crédito de pedidos aún no existe: se enlaza a mano
  const d = await detalle(id)
  expect(d.pago_estado).toBe('a_credito')
  expect(d.pago).toMatchObject({ saldo_pendiente_usd: 100, puede_avanzar: true })
  expect(d.client.saldo_cxc_usd, 'la venta a crédito suma al saldo CxC del cliente').toBeGreaterThanOrEqual(100)
  expect((await mover(id, 'dispatched')).status()).toBe(200)
  expect((await mover(id, 'delivered')).status()).toBe(200)
})

test('un pedido origin "table" (cuentas de mesa) no pasa por las guardas de pago', async () => {
  const enums = sql(`SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND COLUMN_NAME='origin'`)
  test.skip(!enums.includes("'table'"), `OrderOrigin de esta rama no incluye 'table' (${enums}): el módulo de mesas vive en feat/restaurante; la guarda ya lo excluye por código`)
  const id = await pedido()
  sql(`UPDATE orders SET origin='table' WHERE id=${id}`)
  for (const e of ['preparing', 'ready', 'dispatched', 'delivered']) expect((await mover(id, e)).status(), e).toBe(200)
})

test('otro negocio: no se enlaza un cliente ajeno al crear el pedido ni se muestra su resumen', async () => {
  test.skip(!ajeno, 'hace falta un cliente de otro negocio en la DB local')
  const r = await admin.post('/api/orders', {
    data: { origin: 'whatsapp', client_name: `${PREFIJO} Ajeno ${TAG}`, client_id: ajeno, items: [{ product_id: productId, product_name: PRODUCTO, quantity: 1 }] },
  })
  expect(r.status()).toBe(400)
  expect(sql(`SELECT COUNT(*) FROM orders WHERE business_id=${BID} AND client_name='${PREFIJO} Ajeno ${TAG}'`)).toBe('0')

  // aunque una fila quedara apuntando a un cliente de otro negocio (dato heredado), el resumen no se expone
  const id = await pedido(false)
  sql(`UPDATE orders SET client_id=${ajeno} WHERE id=${id}`)
  const d = await detalle(id)
  expect(d.client, 'resumen vacío: el cliente no es de este negocio').toBeNull()
  expect(JSON.stringify(d)).not.toContain(sql(`SELECT name FROM clients WHERE id=${ajeno}`))
  sql(`UPDATE orders SET client_id=NULL WHERE id=${id}`)

  // y el resumen del cliente propio trae lo pedido: nombre, cédula, teléfono, dirección, tier, pedidos previos y saldo
  const propio = await detalle(await pedido())
  expect(propio.client).toMatchObject({ id: clienteId, cedula: CEDULA, phone: '04140000000', address: 'Calle de prueba 1', price_tier: 'detal' })
  expect(propio.client.pedidos_previos).toBeGreaterThanOrEqual(1)
  expect(typeof propio.client.saldo_por_cobrar_usd).toBe('number')
})
