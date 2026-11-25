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
const M_CASHEA = `${PREFIJO} Cashea`
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
let casheaId = 0
let financingOriginal = 'NULL'
let abrimosCaja = false

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
    sql(`DELETE FROM return_items WHERE return_id IN (SELECT id FROM returns WHERE sale_id IN (${ventas}))`)
    sql(`DELETE FROM returns WHERE sale_id IN (${ventas})`)
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
  sql(`INSERT INTO clients (business_id,name,phone,cedula,price_tier,is_active,origin,created_at,updated_at) VALUES (${BID},'${PREFIJO} Cliente ${TAG}','${TEL}','${CED.replace('V', 'V-')}','detal',1,'pos',NOW(3),NOW(3))`)
  clienteId = Number(sql(`SELECT id FROM clients WHERE business_id=${BID} AND name='${PREFIJO} Cliente ${TAG}'`))
  ajeno = Number(sql(`SELECT id FROM clients WHERE business_id<>${BID} ORDER BY id LIMIT 1`)) // solo lectura: cliente de OTRO negocio
  admin = await ctx('admin')
  cajero = await ctx('cashier')
  // cobrar la deuda entra al turno: hace falta un turno abierto en el negocio de pruebas (si no hay, se abre aquí y se cierra al final)
  if (sql(`SELECT COUNT(*) FROM cash_registers WHERE business_id=${BID} AND closed_at IS NULL`) === '0') {
    const r = await admin.post('/api/cash/open', { data: { opening_amount_usd: 0, opening_amount_bs: 0 } })
    expect(r.status(), await r.text()).toBeLessThan(300)
    abrimosCaja = true
  }
})

test.afterAll(async () => {
  limpiar()
  sql(financingOriginal === 'NULL'
    ? `UPDATE businesses SET settings=JSON_REMOVE(settings,'$.financing') WHERE id=${BID} AND settings IS NOT NULL`
    : `UPDATE businesses SET settings=JSON_SET(settings,'$.financing',CAST('${financingOriginal}' AS JSON)) WHERE id=${BID}`)
  if (abrimosCaja) await admin?.post('/api/cash/close', { data: { closing_amount_usd: 0, closing_amount_bs: 0 } })
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
// confirmed_client_id: el personal confirma a qué cliente se le carga el crédito (por defecto el del pedido de prueba).
const credito = (id: number, data: object = { credit_days: 15 }) => admin.post(`/api/orders/${id}/cerrar-credito`, { data: { confirmed_client_id: clienteId, ...data } })
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

test('cliente autorizado SIN cerrar a crédito NO se despacha (puede_despachar = puede_avanzar); tras cerrar a crédito sí, y se entrega', async () => {
  expect((await ficha({ credit_authorized: true, credit_limit_usd: null })).status()).toBe(200)
  const id = await pedido()
  for (const s of ['preparing', 'ready']) expect((await mover(id, s)).status()).toBe(200)
  const d0 = await detalle(id)
  expect(d0.pago).toMatchObject({ pago_estado: 'por_cobrar', puede_avanzar: false, puede_despachar: false })
  const lista = (await (await admin.get('/api/orders?limit=100')).json()) as { orders: Array<{ id: number; pago: { puede_despachar: boolean } }> }
  expect(lista.orders.find(o => o.id === id)?.pago.puede_despachar, 'el listado lo dice igual').toBe(false)

  const bloqueado = await mover(id, 'dispatched')
  expect(bloqueado.status()).toBe(422)
  expect(await bloqueado.json()).toMatchObject({ field: 'payment', code: 'PAYMENT_REQUIRED', pago_estado: 'por_cobrar' })

  // cerrar a crédito (revisa el tope) → a_credito → ya se puede despachar y entregar
  expect((await credito(id)).status()).toBe(200)
  const d1 = await detalle(id)
  expect(d1.pago_estado).toBe('a_credito')
  expect(d1.pago).toMatchObject({ puede_avanzar: true, puede_despachar: true })
  const desp = await mover(id, 'dispatched')
  expect(desp.status(), await desp.text()).toBe(200)
  expect((await desp.json()).override, 'sin override: lo permite el cierre a crédito').toBeUndefined()
  const fin = await mover(id, 'delivered')
  expect(fin.status(), await fin.text()).toBe(200)
  expect(estado(id)).toBe('delivered')
})

test('hallazgo de seguridad: un pedido del CATÁLOGO con la cédula/teléfono de un cliente autorizado queda enlazado pero NO se despacha sin cobro ni cierre', async () => {
  expect((await ficha({ credit_authorized: true, credit_limit_usd: null })).status()).toBe(200)
  const id = await pedido({ origin: 'catalog', client_id: undefined, client_name: `${PREFIJO} Suplantador ${TAG}`, client_cedula: CED, client_phone: TEL })
  expect(sql(`SELECT client_id FROM orders WHERE id=${id}`), 'el enlace automático lo asocia al cliente autorizado').toBe(String(clienteId))
  for (const s of ['preparing', 'ready']) expect((await mover(id, s)).status()).toBe(200)
  const r = await mover(id, 'dispatched')
  expect(r.status(), 'la autorización de crédito NO abre el despacho').toBe(422)
  expect(await r.json()).toMatchObject({ code: 'PAYMENT_REQUIRED' })
  // y el cierre a crédito exige que el personal confirme el cliente: sin id → 400; con un id distinto → 422
  const sinId = await admin.post(`/api/orders/${id}/cerrar-credito`, { data: { credit_days: 15 } })
  expect(sinId.status()).toBe(400)
  const otro = await credito(id, { confirmed_client_id: clienteId + 999_999, credit_days: 15 })
  expect(otro.status()).toBe(422)
  expect(await otro.json()).toMatchObject({ field: 'confirmed_client_id', code: 'CLIENT_NOT_CONFIRMED' })
  expect(sql(`SELECT IFNULL(sale_id,'NULL') FROM orders WHERE id=${id}`)).toBe('NULL')
  expect(entradasVenta(id)).toEqual([])
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
  // existe un cliente con esa cédula: NO se enlaza en silencio → 409 con quién es, y no queda nada enlazado
  const sinConfirmar = await admin.post(`/api/orders/${p2}/crear-cliente`)
  expect(sinConfirmar.status()).toBe(409)
  expect(await sinConfirmar.json()).toMatchObject({ field: 'client', code: 'CLIENT_EXISTS', client_id: j.client_id, name: nombre, cedula: cedGuardada })
  expect(sql(`SELECT IFNULL(client_id,'NULL') FROM orders WHERE id=${p2}`)).toBe('NULL')
  expect(cuenta(), 'el 409 no crea nada').toBe(1)
  // con confirm_existing:true el personal autoriza el enlace
  const r2 = await admin.post(`/api/orders/${p2}/crear-cliente`, { data: { confirm_existing: true } })
  expect(r2.status(), await r2.text()).toBe(200)
  expect(await r2.json()).toMatchObject({ client_id: j.client_id, created: false })
  // solo teléfono coincidente → también enlaza
  const p3 = await pedido({ client_id: undefined, client_name: `${PREFIJO} Tres ${TAG}`, client_phone: `${telNuevo.slice(0, 4)}-${telNuevo.slice(4)}` })
  sql(`UPDATE orders SET client_id=NULL WHERE id=${p3} AND business_id=${BID}`)
  expect((await admin.post(`/api/orders/${p3}/crear-cliente`)).status(), 'por teléfono también pide confirmación').toBe(409)
  expect(await (await admin.post(`/api/orders/${p3}/crear-cliente`, { data: { confirm_existing: true } })).json()).toMatchObject({ client_id: j.client_id, created: false })
  expect(cuenta(), 'sin duplicados').toBe(1)

  // ya enlazado → 409; pedido inexistente → 404; el cajero también puede (acceso a Clientes)
  const again = await admin.post(`/api/orders/${p1}/crear-cliente`)
  expect(again.status()).toBe(409)
  expect(await again.json()).toMatchObject({ code: 'CLIENT_ALREADY_LINKED' })
  expect((await admin.post('/api/orders/999999999/crear-cliente')).status()).toBe(404)
  const p4 = await pedido({ client_id: undefined, client_name: `${PREFIJO} Cuatro ${TAG}` })
  expect((await cajero.post(`/api/orders/${p4}/crear-cliente`)).status()).toBe(200)
})

/* ── Deuda de un Cashea RECHAZADO ya cobrado: $100 = $40 inicial (efectivo) + $60 Cashea ── */

async function casheaRechazado(): Promise<number> {
  const id = await pedido()
  expect((await admin.patch(`/api/orders/${id}/financing`, { data: { action: 'request' } })).status()).toBe(200)
  const c = await admin.post(`/api/orders/${id}/cobrar`, { data: { payment_method_id: casheaId, initial: { payment_method_id: efectivoId, amount_usd: 40 }, cedula: 'V12345678' } })
  expect(c.status(), await c.text()).toBe(200)
  expect((await admin.patch(`/api/orders/${id}/financing`, { data: { action: 'reject' } })).status()).toBe(200)
  return id
}
const caja = async () => ((await (await admin.get('/api/cash/status')).json()) as { turnoStats: { efectivoEsperado: number; totalVentasUsd: number } }).turnoStats
const saleOf = (id: number): number => Number(sql(`SELECT sale_id FROM orders WHERE id=${id}`))
const deuda = (id: number) => admin.post(`/api/orders/${id}/cobrar-deuda-financiamiento`, { data: { payment_method_id: efectivoId, amount_usd: 1 } })

test('deuda de Cashea rechazado: validaciones del cobro (monto, método real, sin deuda, caja)', async () => {
  const id = await casheaRechazado()
  expect((await detalle(id)).pago).toMatchObject({ pago_estado: 'por_cobrar', deuda_cliente_usd: 60, saldo_pendiente_usd: 60 })
  const exceso = await admin.post(`/api/orders/${id}/cobrar-deuda-financiamiento`, { data: { payment_method_id: efectivoId, amount_usd: 60.5 } })
  expect(exceso.status()).toBe(422)
  expect(await exceso.json()).toMatchObject({ code: 'AMOUNT_EXCEEDS_DEBT', field: 'amount_usd', saldo_usd: 60 })
  for (const [nombre, metodo] of [['el financiador', casheaId], ['un método de otro negocio', Number(sql(`SELECT id FROM payment_methods WHERE business_id<>${BID} ORDER BY id LIMIT 1`))], ['un método inexistente', 999999999]] as const) {
    const r = await admin.post(`/api/orders/${id}/cobrar-deuda-financiamiento`, { data: { payment_method_id: metodo, amount_usd: 10 } })
    expect(r.status(), nombre).toBe(422)
    expect(await r.json(), nombre).toMatchObject({ code: 'INVALID_METHOD', field: 'payment_method_id' })
  }
  expect((await admin.post(`/api/orders/${id}/cobrar-deuda-financiamiento`, { data: { amount_usd: 10 } })).status()).toBe(400)
  // un pedido sin Cashea rechazado no tiene deuda
  const normal = await pedido()
  expect((await admin.post(`/api/orders/${normal}/cobrar`, { data: { payment_method_id: efectivoId } })).status()).toBe(200)
  const sinDeuda = await deuda(normal)
  expect(sinDeuda.status()).toBe(409)
  expect(await sinDeuda.json()).toMatchObject({ code: 'NO_DEBT' })
  expect(sql(`SELECT COUNT(*) FROM sale_abonos WHERE sale_id IN (${saleOf(id)},${saleOf(normal)})`), 'ningún intento inválido dejó abonos').toBe('0')
})

test('cobrar la deuda: SaleAbono sobre la venta ORIGINAL (sin venta nueva), caja +efectivo, ventas netas intactas, y sale de CxC al saldarse', async () => {
  const id = await casheaRechazado()
  const venta = saleOf(id)
  const ventasAntes = sql(`SELECT COUNT(*) FROM sales WHERE business_id=${BID} AND client_id=${clienteId}`)
  const pagosAntes = sql(`SELECT COUNT(*) FROM sale_payments WHERE sale_id=${venta}`)
  const c0 = await caja()
  const deudaCli0: number = (await detalle(id)).client.deuda_financiamiento_usd // incluye deudas de otros pedidos del mismo cliente

  // aparece en Finanzas › CxC como deuda de financiamiento
  const cxc0 = (await (await admin.get('/api/finanzas/cxc?limit=100')).json()) as { items: Array<{ sale_id: number; kind: string; saldo_usd: number; total_usd: number }> }
  expect(cxc0.items.find(i => i.sale_id === venta)).toMatchObject({ kind: 'financiamiento', saldo_usd: 60, total_usd: 60 })
  const resumen0 = (await (await admin.get('/api/finanzas/cxc/summary')).json()) as Record<'vencido' | 'por_vencer' | 'vigente', { count: number; total_usd: number }>
  expect(resumen0.vencido.total_usd + resumen0.por_vencer.total_usd + resumen0.vigente.total_usd, 'el resumen suma la deuda').toBeGreaterThanOrEqual(60)

  // abono parcial desde el pedido (efectivo, método real)
  const p1 = await admin.post(`/api/orders/${id}/cobrar-deuda-financiamiento`, { data: { payment_method_id: efectivoId, amount_usd: 20 } })
  expect(p1.status(), await p1.text()).toBe(201)
  expect(await p1.json()).toMatchObject({ saldo_usd: 40, pagada: false, pago_estado: 'por_cobrar' })
  expect(sql(`SELECT status FROM sales WHERE id=${venta}`), 'la venta original no cambia de estado').toBe('paid')
  expect(sql(`SELECT COUNT(*) FROM sales WHERE business_id=${BID} AND client_id=${clienteId}`), 'sin venta nueva').toBe(ventasAntes)
  expect(sql(`SELECT COUNT(*) FROM sale_payments WHERE sale_id=${venta}`), 'la línea Cashea queda como está (sin movimientos nuevos)').toBe(pagosAntes)
  expect(sql(`SELECT CONCAT(payment_method_id,'|',amount_usd,'|',IFNULL(cash_register_id,'NULL')<>'NULL') FROM sale_abonos WHERE sale_id=${venta}`)).toBe(`${efectivoId}|20.00|1`)
  const d1 = await detalle(id)
  expect(d1.pago).toMatchObject({ pago_estado: 'por_cobrar', deuda_cliente_usd: 40, saldo_pendiente_usd: 40, recibido_usd: 60 })
  expect(d1.client.deuda_financiamiento_usd, 'la deuda del cliente baja lo abonado').toBeCloseTo(deudaCli0 - 20, 2)

  // caja: solo el efectivo mueve el esperado (+ el monto en Bs del abono); ventas netas NO suben (ya contaban los $100)
  const c1 = await caja()
  const abonoBs = Number(sql(`SELECT amount_bs FROM sale_abonos WHERE sale_id=${venta}`))
  expect(c1.efectivoEsperado - c0.efectivoEsperado).toBeCloseTo(abonoBs, 1)
  expect(c1.totalVentasUsd).toBeCloseTo(c0.totalVentasUsd, 2)

  // el resto, desde Finanzas › CxC (misma venta original)
  const p2 = await admin.post(`/api/finanzas/cxc/${venta}/abono`, { data: { payment_method_id: efectivoId, amount_usd: 40 } })
  expect(p2.status(), await p2.text()).toBe(201)
  expect(await p2.json()).toMatchObject({ saldo_usd: 0, paid: true })
  expect(sql(`SELECT status FROM sales WHERE id=${venta}`)).toBe('paid')
  const d2 = await detalle(id)
  expect(d2.pago).toMatchObject({ pago_estado: 'cobrado', deuda_cliente_usd: 0, saldo_pendiente_usd: 0, recibido_usd: 100 })
  expect(d2.client.deuda_financiamiento_usd).toBeCloseTo(deudaCli0 - 60, 2)
  const cxc2 = (await (await admin.get('/api/finanzas/cxc?limit=100')).json()) as { items: Array<{ sale_id: number }> }
  expect(cxc2.items.find(i => i.sale_id === venta), 'saldada: sale de CxC').toBeUndefined()
  const c2 = await caja()
  expect(c2.efectivoEsperado - c0.efectivoEsperado).toBeCloseTo(Number(sql(`SELECT SUM(amount_bs) FROM sale_abonos WHERE sale_id=${venta}`)), 1)
  expect(c2.totalVentasUsd, 'ventas netas siguen en lo mismo: el dinero no se contó dos veces').toBeCloseTo(c0.totalVentasUsd, 2)
  // ya sin deuda: otro cobro → 409
  expect((await deuda(id)).status()).toBe(409)

  // devolución posterior con la deuda saldada: puede reembolsar lo cobrado completo ($100)
  const ret = await admin.post('/api/returns', { data: { sale_id: venta, reason: 'Prueba de devolución', refund_payment_method_id: efectivoId, items: [{ product_id: productId, qty: 1 }] } })
  expect(ret.status(), await ret.text()).toBe(201)
})

test('devolución con la deuda de Cashea PENDIENTE: reembolsa como máximo lo realmente cobrado ($40 de $100)', async () => {
  const id = await casheaRechazado()
  const venta = saleOf(id)
  const dev = (qty: number) => admin.post('/api/returns', { data: { sale_id: venta, reason: 'Prueba de tope', refund_payment_method_id: efectivoId, items: [{ product_id: productId, qty }] } })
  const total = await dev(1)
  expect(total.status(), 'el reembolso de $100 supera los $40 realmente cobrados').toBe(422)
  expect(await total.json()).toMatchObject({ code: 'REFUND_EXCEEDS_COLLECTED', cobrado_disponible_usd: 40, deuda_pendiente_usd: 60 })
  expect(sql(`SELECT COUNT(*) FROM returns WHERE sale_id=${venta}`)).toBe('0')
  const ok = await dev(0.4)
  expect(ok.status(), await ok.text()).toBe(201)
  const otra = await dev(0.1)
  expect(otra.status(), 'ya se reembolsó lo cobrado: nada más').toBe(422)
  expect(await otra.json()).toMatchObject({ code: 'REFUND_EXCEEDS_COLLECTED', cobrado_disponible_usd: 0 })
})
