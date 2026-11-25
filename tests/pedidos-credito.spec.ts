import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Pedidos, parte 2: crédito del cliente (autorizado + tope), cerrar el pedido a crédito (venta 'credit' enlazada, sin cambiar la etapa),
 * despacho con crédito autorizado y enlace pedido↔cliente. Negocio de pruebas propio (ZZA, E2E_BUSINESS_ID); de otros negocios solo se
 * LEE un id de cliente. Servidor local en :3001.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const { businessId: BID, adminId: ADMIN } = ownBusiness()
const TAG = String(Date.now()).slice(-6)
const PREFIJO = 'ZZA Ped'
const PRODUCTO = `${PREFIJO} Producto ${TAG}`
const M_EFECTIVO = `${PREFIJO} Efectivo`
const TEL = `0414${TAG}1`
const CED = `V${TAG}11`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let admin: APIRequestContext
let cajero: APIRequestContext
let productId = 0
let clienteId = 0
let ajeno = 0
let efectivoId = 0

const token = (role: string) =>
  new SignJWT({ userId: ADMIN, businessId: BID, role, name: 'ZZA Pedidos' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
const ctx = async (role: string) => pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token(role)}` } })
const lineas = (s: string): string[] => s.split(/\r?\n/).map(x => x.trim()).filter(Boolean)

function limpiar(): void {
  const ordenes = lineas(sql(`SELECT id FROM orders WHERE business_id=${BID} AND client_name LIKE '${PREFIJO} %'`)).join(',')
  const ventas = lineas(sql(`SELECT sale_id FROM orders WHERE business_id=${BID} AND client_name LIKE '${PREFIJO} %' AND sale_id IS NOT NULL`)).join(',')
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
  limpiar()
  sql(`INSERT INTO payment_methods (business_id,name,type,sort_order,is_active,is_financing) VALUES (${BID},'${M_EFECTIVO}','cash',-30,1,0)`)
  efectivoId = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BID} AND name='${M_EFECTIVO}'`))
  sql(`INSERT INTO products (business_id,name,images,price_per_unit_usd,sale_mode,product_type,active,available_in_pos,show_in_catalog,catalog_visibility,is_available,availability,updated_at)
       VALUES (${BID},'${PRODUCTO}','[]',100,'service','simple',1,1,0,'visible',1,'in_stock',NOW(3))`)
  productId = Number(sql(`SELECT id FROM products WHERE business_id=${BID} AND name='${PRODUCTO}'`))
  sql(`INSERT INTO clients (business_id,name,phone,cedula,price_tier,is_active,origin,created_at,updated_at) VALUES (${BID},'${PREFIJO} Cliente ${TAG}','${TEL}','${CED.replace('V', 'V-')}','detal',1,'pos',NOW(3),NOW(3))`)
  clienteId = Number(sql(`SELECT id FROM clients WHERE business_id=${BID} AND name='${PREFIJO} Cliente ${TAG}'`))
  ajeno = Number(sql(`SELECT id FROM clients WHERE business_id<>${BID} ORDER BY id LIMIT 1`)) // solo lectura: cliente de OTRO negocio
  admin = await ctx('admin')
  cajero = await ctx('cashier')
})

test.afterAll(async () => {
  limpiar()
  await admin?.dispose()
  await cajero?.dispose()
})

async function pedido(extra: object = { client_id: clienteId }): Promise<number> {
  const r = await admin.post('/api/orders', {
    data: { origin: 'whatsapp', client_name: `${PREFIJO} Cliente ${TAG}`, items: [{ product_id: productId, product_name: PRODUCTO, quantity: 1 }], ...extra },
  })
  expect(r.status(), await r.text()).toBeLessThan(300)
  return ((await r.json()) as { order: { id: number } }).order.id
}
const detalle = async (id: number) => ((await (await admin.get(`/api/orders/${id}`)).json()) as { order: Record<string, any> }).order // eslint-disable-line @typescript-eslint/no-explicit-any
const estado = (id: number): string => sql(`SELECT status FROM orders WHERE id=${id}`)
const mover = (id: number, status: string, extra: object = {}) => admin.patch(`/api/orders/${id}`, { data: { status, ...extra } })
const credito = (id: number, data: object = { credit_days: 15 }) => admin.post(`/api/orders/${id}/cerrar-credito`, { data })
const ficha = (data: object) => admin.patch(`/api/clients/${clienteId}`, { data })
const entradasVenta = (id: number): string[] => lineas(sql(`SELECT CONCAT(quantity,'/',waste) FROM inventory_entries WHERE business_id=${BID} AND product_id=${productId} AND entry_type='sale' AND notes LIKE CONCAT('%pedido ',(SELECT order_number FROM orders WHERE id=${id}),'%')`))

test('cliente SIN crédito autorizado: cerrar-credito responde 422 y no deja venta ni stock', async () => {
  const id = await pedido()
  const r = await credito(id)
  expect(r.status(), await r.text()).toBe(422)
  expect(await r.json()).toMatchObject({ field: 'credit', code: 'CREDIT_NOT_AUTHORIZED' })
  expect(sql(`SELECT IFNULL(sale_id,'NULL') FROM orders WHERE id=${id}`)).toBe('NULL')
  expect(entradasVenta(id)).toEqual([])
  expect((await detalle(id)).pago).toMatchObject({ pago_estado: 'por_cobrar', puede_despachar: false })
})

test('solo un administrador autoriza crédito o fija el tope (cajero 403, admin 200)', async () => {
  const c = await cajero.patch(`/api/clients/${clienteId}`, { data: { credit_authorized: true } })
  expect(c.status()).toBe(403)
  expect(await c.json()).toMatchObject({ code: 'CREDIT_FORBIDDEN' })
  const t = await cajero.patch(`/api/clients/${clienteId}`, { data: { credit_limit_usd: 500 } })
  expect(t.status()).toBe(403)
  expect(sql(`SELECT credit_authorized FROM clients WHERE id=${clienteId}`)).toBe('0')
  const r = await ficha({ credit_authorized: true, credit_limit_usd: 150 })
  expect(r.status(), await r.text()).toBe(200)
  expect(sql(`SELECT CONCAT(credit_authorized,'/',credit_limit_usd) FROM clients WHERE id=${clienteId}`)).toBe('1/150.00')
})

let creditoA = 0

test('autorizado DENTRO del límite: queda a_credito, venta credit enlazada, stock como el POS y la etapa intacta', async () => {
  creditoA = await pedido()
  const r = await credito(creditoA, { credit_days: 15, credit_notes: 'Pago a 15 días' })
  expect(r.status(), await r.text()).toBe(200)
  const j = (await r.json()) as { sale_id: number; pago_estado: string; saldo_pendiente_usd: number; credit_days: number }
  expect(j).toMatchObject({ ok: true, pago_estado: 'a_credito', saldo_pendiente_usd: 100, credit_days: 15 })
  expect(estado(creditoA), 'la etapa no se toca').toBe('received')
  // misma forma que una venta a crédito del POS: status/origin credit, sin pagos, sin sold_at, con vencimiento y plazo
  expect(sql(`SELECT CONCAT(status,'/',origin,'/',IFNULL(sold_at,'NULL'),'/',credit_days,'/',client_id) FROM sales WHERE id=${j.sale_id}`)).toBe(`credit/credit/NULL/15/${clienteId}`)
  expect(sql(`SELECT IF(due_date > NOW(), 'futuro', 'pasado') FROM sales WHERE id=${j.sale_id}`)).toBe('futuro')
  expect(sql(`SELECT COUNT(*) FROM sale_payments WHERE sale_id=${j.sale_id}`)).toBe('0')
  expect(sql(`SELECT sale_id FROM orders WHERE id=${creditoA}`)).toBe(String(j.sale_id))
  // stock: una deducción 'sale' de -1, igual que el POS en una venta a crédito
  expect(entradasVenta(creditoA)).toEqual(['-1.000/0.000'])
  const d = await detalle(creditoA)
  expect(d.pago_estado).toBe('a_credito')
  expect(d.pago).toMatchObject({ saldo_pendiente_usd: 100, puede_avanzar: true, puede_despachar: true })
  // el saldo del cliente suma esta venta y el disponible baja (tope 150)
  expect(d.client).toMatchObject({ saldo_cxc_usd: 100, saldo_por_cobrar_usd: 100, credit_authorized: true, credit_limit_usd: 150, credito_disponible_usd: 50 })
  // ya enlazado: no se cierra ni se cobra otra vez
  expect((await credito(creditoA)).status()).toBe(409)
  expect((await admin.post(`/api/orders/${creditoA}/cobrar`, { data: { payment_method_id: efectivoId } })).status()).toBe(409)
})

test('autorizado FUERA del límite: 422 con el disponible, y sin tope (null) pasa', async () => {
  const id = await pedido()
  const r = await credito(id)
  expect(r.status(), await r.text()).toBe(422)
  expect(await r.json()).toMatchObject({ field: 'credit', code: 'CREDIT_LIMIT_EXCEEDED', credit_limit_usd: 150, saldo_por_cobrar_usd: 100, total_usd: 100, disponible_usd: 50 })
  expect(sql(`SELECT IFNULL(sale_id,'NULL') FROM orders WHERE id=${id}`)).toBe('NULL')
  expect(entradasVenta(id)).toEqual([])
  expect((await ficha({ credit_limit_usd: null })).status()).toBe(200)
  const ok = await credito(id, { due_date: new Date(Date.now() + 10 * 86_400_000).toISOString() })
  expect(ok.status(), await ok.text()).toBe(200)
  expect(sql(`SELECT IFNULL(credit_days,'NULL') FROM sales WHERE id=(SELECT sale_id FROM orders WHERE id=${id})`), 'solo vencimiento: sin credit_days').toBe('NULL')
})

test('validaciones del cierre: plazo obligatorio, vencimiento futuro, sin cliente y cliente de OTRO negocio', async () => {
  const id = await pedido()
  const sinPlazo = await credito(id, {})
  expect(sinPlazo.status()).toBe(422)
  expect(await sinPlazo.json()).toMatchObject({ field: 'credit_days', code: 'TERM_REQUIRED' })
  const pasado = await credito(id, { due_date: new Date(Date.now() - 86_400_000).toISOString() })
  expect(pasado.status()).toBe(422)
  expect(await pasado.json()).toMatchObject({ field: 'due_date', code: 'DUE_DATE_PAST' })

  const sinCliente = await pedido({})
  const s = await credito(sinCliente)
  expect(s.status()).toBe(422)
  expect(await s.json()).toMatchObject({ field: 'client', code: 'CLIENT_REQUIRED' })

  // un pedido NUNCA se crea con cliente ajeno (POST lo rechaza); si el dato llegara a quedar colgado, tampoco cuenta
  expect(ajeno, 'debe existir un cliente de otro negocio').toBeGreaterThan(0)
  const rechazado = await admin.post('/api/orders', { data: { origin: 'whatsapp', client_id: ajeno, client_name: `${PREFIJO} Ajeno`, items: [{ product_id: productId, product_name: PRODUCTO, quantity: 1 }] } })
  expect(rechazado.status()).toBe(400)
  const colgado = await pedido({})
  sql(`UPDATE orders SET client_id=${ajeno} WHERE id=${colgado} AND business_id=${BID}`)
  const a = await credito(colgado)
  expect(a.status()).toBe(422)
  expect(await a.json()).toMatchObject({ code: 'CLIENT_REQUIRED' })
  expect((await detalle(colgado)).client, 'el resumen no expone al cliente de otro negocio').toBeNull()
  expect(sql(`SELECT IFNULL(sale_id,'NULL') FROM orders WHERE id=${colgado}`)).toBe('NULL')
})

test('despacho con cliente autorizado SIN cerrar a crédito: despacha, pero entregar sigue exigiendo cobro o crédito', async () => {
  expect((await ficha({ credit_authorized: true, credit_limit_usd: null })).status()).toBe(200)
  const id = await pedido()
  for (const s of ['preparing', 'ready']) expect((await mover(id, s)).status()).toBe(200)
  const d0 = await detalle(id)
  expect(d0.pago).toMatchObject({ pago_estado: 'por_cobrar', puede_avanzar: false, puede_despachar: true })
  const lista = (await (await admin.get('/api/orders?limit=100')).json()) as { orders: Array<{ id: number; pago: { puede_despachar: boolean } }> }
  expect(lista.orders.find(o => o.id === id)?.pago.puede_despachar, 'el listado lo dice igual').toBe(true)

  const desp = await mover(id, 'dispatched')
  expect(desp.status(), await desp.text()).toBe(200)
  expect((await desp.json()).override, 'sin override: lo permite el crédito').toBeUndefined()
  expect(sql(`SELECT COUNT(*) FROM activity_logs WHERE business_id=${BID} AND model_type='Order' AND model_id=${id} AND action='order_dispatch_override'`)).toBe('0')

  const ent = await mover(id, 'delivered')
  expect(ent.status()).toBe(422)
  expect(await ent.json()).toMatchObject({ field: 'payment', code: 'PAYMENT_REQUIRED', pago_estado: 'por_cobrar' })

  // cerrar a crédito → a_credito → ya se puede entregar
  expect((await credito(id)).status()).toBe(200)
  expect((await detalle(id)).pago_estado).toBe('a_credito')
  const fin = await mover(id, 'delivered')
  expect(fin.status(), await fin.text()).toBe(200)
  expect(estado(id)).toBe('delivered')
})

test('sin crédito autorizado el despacho vuelve a exigir cobro (override de admin con motivo se conserva)', async () => {
  expect((await ficha({ credit_authorized: false })).status()).toBe(200)
  const id = await pedido()
  for (const s of ['preparing', 'ready']) expect((await mover(id, s)).status()).toBe(200)
  expect((await detalle(id)).pago).toMatchObject({ puede_despachar: false })
  const r = await mover(id, 'dispatched')
  expect(r.status()).toBe(422)
  expect(await r.json()).toMatchObject({ field: 'payment', code: 'PAYMENT_REQUIRED' })
  const ov = await mover(id, 'dispatched', { override_reason: 'Cliente de confianza, cobra mañana' })
  expect(ov.status(), await ov.text()).toBe(200)
  expect((await ov.json()).override).toBe(true)
})

test("una venta 'returned' (devolución total) sigue siendo por_cobrar: no deja despachar sin cobrar", async () => {
  const id = await pedido()
  expect((await admin.post(`/api/orders/${id}/cobrar`, { data: { payment_method_id: efectivoId } })).status()).toBe(200)
  expect((await detalle(id)).pago_estado).toBe('cobrado')
  sql(`UPDATE sales SET status='returned' WHERE business_id=${BID} AND id=(SELECT sale_id FROM orders WHERE id=${id})`)
  expect((await detalle(id)).pago).toMatchObject({ pago_estado: 'por_cobrar', puede_avanzar: false, puede_despachar: false })
  for (const s of ['preparing', 'ready']) expect((await mover(id, s)).status()).toBe(200)
  const r = await mover(id, 'dispatched')
  expect(r.status()).toBe(422)
  expect(await r.json()).toMatchObject({ code: 'PAYMENT_REQUIRED' })
})

test('enlace automático: UNA coincidencia exacta (teléfono o cédula) enlaza; ninguna o ambigua deja client_id en null', async () => {
  const cli = (id: number) => sql(`SELECT IFNULL(client_id,'NULL') FROM orders WHERE id=${id}`)
  // teléfono con otro formato (0414-xxxxxxx) → el normalizado coincide con UN cliente
  const tel = await pedido({ client_id: undefined, client_phone: `${TEL.slice(0, 4)}-${TEL.slice(4)}` })
  expect(cli(tel)).toBe(String(clienteId))
  // cédula sola
  const ced = await pedido({ client_id: undefined, client_cedula: CED })
  expect(cli(ced)).toBe(String(clienteId))
  // sin datos de contacto o sin coincidencia → null
  expect(cli(await pedido({ client_id: undefined }))).toBe('NULL')
  expect(cli(await pedido({ client_id: undefined, client_phone: '04149999999', client_cedula: 'V99999999' }))).toBe('NULL')
  // un segundo cliente con el MISMO teléfono → ambiguo → null (no se adivina)
  sql(`INSERT INTO clients (business_id,name,phone,cedula,price_tier,is_active,origin,created_at,updated_at) VALUES (${BID},'${PREFIJO} Gemelo ${TAG}','${TEL}',NULL,'detal',1,'pos',NOW(3),NOW(3))`)
  expect(cli(await pedido({ client_id: undefined, client_phone: TEL }))).toBe('NULL')
  // cédula de uno y teléfono del otro apuntan a clientes distintos → también ambiguo
  expect(cli(await pedido({ client_id: undefined, client_phone: TEL, client_cedula: CED }))).toBe('NULL')
  // un cliente de OTRO negocio con ese teléfono nunca cuenta
  const telAjeno = sql(`SELECT IFNULL(phone,'') FROM clients WHERE id=${ajeno}`)
  if (telAjeno) expect(cli(await pedido({ client_id: undefined, client_phone: telAjeno }))).toBe('NULL')
})

test('crear-cliente: crea con los datos del pedido, enlaza el existente (sin duplicar) y no pisa un enlace previo', async () => {
  const telNuevo = `0424${TAG}7`
  const cedNueva = `V${TAG}77`
  const nombre = `${PREFIJO} Nuevo ${TAG}`
  const cedGuardada = cedNueva.replace('V', 'V-') // las cédulas se guardan normalizadas (V-12345678)
  const cuenta = (): number => Number(sql(`SELECT COUNT(*) FROM clients WHERE business_id=${BID} AND (cedula='${cedGuardada}' OR phone='${telNuevo}')`))
  const p1 = await pedido({ client_id: undefined, client_name: nombre, client_phone: telNuevo, client_cedula: cedNueva })
  expect(sql(`SELECT IFNULL(client_id,'NULL') FROM orders WHERE id=${p1}`)).toBe('NULL')
  const r = await admin.post(`/api/orders/${p1}/crear-cliente`)
  expect(r.status(), await r.text()).toBe(200)
  const j = (await r.json()) as { client_id: number; created: boolean }
  expect(j.created).toBe(true)
  expect(sql(`SELECT CONCAT(name,'|',phone,'|',cedula,'|',origin) FROM clients WHERE id=${j.client_id} AND business_id=${BID}`)).toBe(`${nombre}|${telNuevo}|${cedGuardada}|pos`)
  expect(sql(`SELECT client_id FROM orders WHERE id=${p1}`)).toBe(String(j.client_id))
  expect(cuenta()).toBe(1)

  // otro pedido con la MISMA cédula (y otro nombre): enlaza al existente, no crea
  const p2 = await pedido({ client_id: undefined, client_name: `${PREFIJO} Otro ${TAG}`, client_phone: '04165550000', client_cedula: cedNueva })
  expect(sql(`SELECT client_id FROM orders WHERE id=${p2}`), 'al crearse ya se auto-enlazó por cédula').toBe(String(j.client_id))
  sql(`UPDATE orders SET client_id=NULL WHERE id=${p2} AND business_id=${BID}`) // simula un pedido huérfano (creado antes que el cliente)
  const r2 = await admin.post(`/api/orders/${p2}/crear-cliente`)
  expect(r2.status(), await r2.text()).toBe(200)
  expect(await r2.json()).toMatchObject({ client_id: j.client_id, created: false })
  // solo teléfono coincidente → también enlaza
  const p3 = await pedido({ client_id: undefined, client_name: `${PREFIJO} Tres ${TAG}`, client_phone: `${telNuevo.slice(0, 4)}-${telNuevo.slice(4)}` })
  sql(`UPDATE orders SET client_id=NULL WHERE id=${p3} AND business_id=${BID}`)
  expect(await (await admin.post(`/api/orders/${p3}/crear-cliente`)).json()).toMatchObject({ client_id: j.client_id, created: false })
  expect(cuenta(), 'sin duplicados').toBe(1)

  // ya enlazado → 409; pedido inexistente → 404; el cajero también puede (acceso a Clientes)
  const again = await admin.post(`/api/orders/${p1}/crear-cliente`)
  expect(again.status()).toBe(409)
  expect(await again.json()).toMatchObject({ code: 'CLIENT_ALREADY_LINKED' })
  expect((await admin.post('/api/orders/999999999/crear-cliente')).status()).toBe(404)
  const p4 = await pedido({ client_id: undefined, client_name: `${PREFIJO} Cuatro ${TAG}` })
  expect((await cajero.post(`/api/orders/${p4}/crear-cliente`)).status()).toBe(200)
})
