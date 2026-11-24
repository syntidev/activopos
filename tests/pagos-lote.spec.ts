import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Lote de pagos: (a) cash/movement valida el método (tenant + activo), (b) sales y sales/[id]/pay rechazan métodos inactivos,
 * (c) Carta: "Efectivo USD" ya no sale como opción Bs, (d) y (e) alta de tenants: catalog_divisa_methods y Efectivo Bs inactivo.
 * Negocio de pruebas propio (ZZA, E2E_BUSINESS_ID); del 217 (ZZB) solo se LEE un id de método. Servidor local en :3001.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const { businessId: BID, adminId: ADMIN, slug: SLUG } = ownBusiness()
const TAG = String(Date.now()).slice(-6)
const CONCEPTO = `ZZA pagos ${TAG}`
const PRODUCTO = `ZZA Pago Producto ${TAG}`
const M_USD = 'ZZA Pago Efectivo USD'
const M_BS = 'ZZA Pago Movil'
const M_OFF = 'ZZA Pago Inactivo'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let admin: APIRequestContext
let sa: APIRequestContext
let plantilla = ''
let activosOriginales = ''
let divisaOriginal = 'NULL'
let abriCaja = 0
let productId = 0
let ajeno = 0
const idOf = (name: string): number => Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BID} AND name='${name}'`))
const toDelete: number[] = []

const token = (userId: number, businessId: number, role: string) =>
  new SignJWT({ userId, businessId, role, name: 'ZZA Pagos' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
const ctx = async (userId: number, businessId: number, role: string) =>
  pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token(userId, businessId, role)}` } })

function limpiar(): void {
  sql(`DELETE FROM cash_movements WHERE business_id=${BID} AND concept LIKE 'ZZA pagos%'`)
  if (abriCaja) {
    sql(`DELETE FROM activity_logs WHERE business_id=${BID} AND model_type='CashRegister' AND model_id=${abriCaja}`)
    sql(`DELETE FROM cash_registers WHERE id=${abriCaja} AND business_id=${BID}`)
  }
  const ventas = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZA Pago Producto%')`).split('\n').filter(Boolean).join(',')
  if (ventas) {
    sql(`DELETE FROM sale_payments WHERE sale_id IN (${ventas})`)
    sql(`DELETE FROM sale_items WHERE sale_id IN (${ventas})`)
    sql(`DELETE FROM sales WHERE business_id=${BID} AND id IN (${ventas})`)
  }
  sql(`DELETE FROM products WHERE business_id=${BID} AND name LIKE 'ZZA Pago Producto%'`)
  sql(`DELETE FROM payment_methods WHERE business_id=${BID} AND name LIKE 'ZZA Pago %'`)
}

test.beforeAll(async () => {
  plantilla = sql(`SELECT catalog_template FROM businesses WHERE id=${BID}`)
  activosOriginales = sql(`SELECT GROUP_CONCAT(id) FROM payment_methods WHERE business_id=${BID} AND is_active=1`)
  divisaOriginal = sql(`SELECT IFNULL(JSON_EXTRACT(settings,'$.catalog_divisa_methods'),'NULL') FROM businesses WHERE id=${BID}`)
  limpiar()
  // métodos propios primero en el orden (sort_order negativo): Efectivo USD (cash), Pago Móvil (transfer) y uno inactivo
  sql(`INSERT INTO payment_methods (business_id,name,type,sort_order,is_active) VALUES (${BID},'${M_USD}','cash',-20,1),(${BID},'${M_BS}','transfer',-10,1),(${BID},'${M_OFF}','transfer',-5,0)`)
  sql(`INSERT INTO products (business_id,name,images,price_per_unit_usd,sale_mode,product_type,active,available_in_pos,show_in_catalog,catalog_visibility,is_available,availability,updated_at)
       VALUES (${BID},'${PRODUCTO}','[]',5,'service','simple',1,1,1,'visible',1,'in_stock',NOW(3))`)
  productId = Number(sql(`SELECT id FROM products WHERE business_id=${BID} AND name='${PRODUCTO}'`))
  ajeno = Number(sql(`SELECT id FROM payment_methods WHERE business_id=217 ORDER BY id LIMIT 1`)) // solo lectura: método del negocio B
  expect(ajeno, 'hace falta un método del negocio 217 (ZZB)').toBeGreaterThan(0)

  admin = await ctx(ADMIN, BID, 'admin')
  const superRow = sql("SELECT CONCAT(id,'|',business_id) FROM users WHERE role='super_admin' ORDER BY id LIMIT 1").split('|').map(Number)
  sa = await ctx(superRow[0], superRow[1], 'super_admin')
  // caja abierta (cash/movement la exige); si no había una, esta spec la abre y la borra al final
  if (!sql(`SELECT id FROM cash_registers WHERE business_id=${BID} AND closed_at IS NULL LIMIT 1`)) {
    const r = await admin.post('/api/cash/open', { data: { opening_amount_usd: 0, opening_amount_bs: 0 } })
    expect(r.status(), await r.text()).toBeLessThan(300)
    abriCaja = Number(sql(`SELECT id FROM cash_registers WHERE business_id=${BID} AND closed_at IS NULL LIMIT 1`))
  }
})

test.afterAll(async () => {
  for (const id of toDelete) await sa?.delete(`/api/admin/tenants/${id}`)
  limpiar()
  if (activosOriginales) sql(`UPDATE payment_methods SET is_active=1 WHERE business_id=${BID} AND id IN (${activosOriginales})`)
  sql(divisaOriginal === 'NULL'
    ? `UPDATE businesses SET settings=JSON_REMOVE(settings,'$.catalog_divisa_methods') WHERE id=${BID} AND settings IS NOT NULL`
    : `UPDATE businesses SET settings=JSON_SET(settings,'$.catalog_divisa_methods',CAST('${divisaOriginal}' AS JSON)) WHERE id=${BID}`)
  sql(`UPDATE businesses SET catalog_template='${plantilla}' WHERE id=${BID}`)
  await admin?.dispose()
  await sa?.dispose()
})

const movimiento = (payment_method_id?: number) =>
  admin.post('/api/cash/movement', { data: { type: 'in', amount_bs: 0, amount_usd: 0, concept: CONCEPTO, ...(payment_method_id !== undefined ? { payment_method_id } : {}) } })
const filas = (): number => Number(sql(`SELECT COUNT(*) FROM cash_movements WHERE business_id=${BID} AND concept='${CONCEPTO}'`))

test('(a) cash/movement: método de otro negocio o inactivo → 403 y no se crea la fila; propio activo o sin método → 201', async () => {
  const ajena = await movimiento(ajeno)
  expect(ajena.status(), await ajena.text()).toBe(403)
  expect((await ajena.json()).error).toBe('Método de pago no válido para este negocio')
  expect((await movimiento(idOf(M_OFF))).status()).toBe(403)
  expect((await movimiento(999999999)).status()).toBe(403)
  expect(filas(), 'ninguna fila con método ajeno/inactivo/inexistente').toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM cash_movements WHERE payment_method_id=${ajeno}`)), 'nada se registró contra el método del negocio B').toBe(0)

  const ok = await movimiento(idOf(M_USD))
  expect(ok.status(), await ok.text()).toBe(201)
  expect((await movimiento()).status(), 'payment_method_id es opcional').toBe(201)
  expect(filas()).toBe(2)
})

async function ventaCon(metodo: number, status: 'paid' | 'pending'): Promise<{ res: Awaited<ReturnType<APIRequestContext['post']>> }> {
  const rate = Number(sql(`SELECT rate FROM dollar_rates WHERE business_id=${BID} ORDER BY id DESC LIMIT 1`)) || 1
  const res = await admin.post('/api/sales', {
    data: {
      items: [{ product_id: productId, quantity: 1, sale_mode: 'service', price_per_unit_usd: 5 }], status, origin: 'pos',
      ...(status === 'paid' ? { payments: [{ payment_method_id: metodo, amount_usd: 5, amount_bs: Math.round(5 * Math.max(rate, 1) * 100) / 100 }] } : {}),
    },
  })
  return { res }
}

test('(b) sales y sales/[id]/pay: método inactivo (o de otro negocio) → 403', async () => {
  for (const [nombre, id] of [['inactivo', idOf(M_OFF)], ['de otro negocio', ajeno]] as const) {
    const { res } = await ventaCon(id, 'paid')
    expect(res.status(), `sales con método ${nombre}: ${await res.text()}`).toBe(403)
    expect((await res.json()).error).toBe('Método de pago no válido para este negocio')
  }
  expect(Number(sql(`SELECT COUNT(*) FROM sale_items WHERE product_id=${productId}`)), 'no se creó ninguna venta').toBe(0)

  // sales/[id]/pay: venta pendiente + cobro con método inactivo
  const pendiente = await ventaCon(0, 'pending')
  expect(pendiente.res.status(), await pendiente.res.text()).toBeLessThan(300)
  const saleId = Number(sql(`SELECT MAX(sale_id) FROM sale_items WHERE product_id=${productId}`))
  const rate = Number(sql(`SELECT rate FROM dollar_rates WHERE business_id=${BID} ORDER BY id DESC LIMIT 1`)) || 1
  for (const [nombre, id] of [['inactivo', idOf(M_OFF)], ['de otro negocio', ajeno]] as const) {
    const pay = await admin.patch(`/api/sales/${saleId}/pay`, { data: { payments: [{ payment_method_id: id, amount_usd: 5, amount_bs: Math.round(5 * Math.max(rate, 1) * 100) / 100 }] } })
    expect(pay.status(), `pay con método ${nombre}: ${await pay.text()}`).toBe(403)
    expect((await pay.json()).error).toBe('Método de pago no válido para este negocio')
  }
  expect(sql(`SELECT status FROM sales WHERE id=${saleId}`), 'la venta sigue pendiente').toBe('pending')
})

/** payOptions de la Carta: viajan como props en el payload de la página. */
async function payOptions(): Promise<Array<{ kind: string; label: string; method: string }>> {
  const html = await (await admin.get(`/catalogo-carta/${SLUG}`)).text()
  const i = html.indexOf('payOptions')
  expect(i, 'la Carta lleva payOptions').toBeGreaterThan(-1)
  const j = html.indexOf('[', i)
  return JSON.parse(html.slice(j, html.indexOf(']', j) + 1).replace(/\\"/g, '"').replace(/\$\$/g, '$')) as Array<{ kind: string; label: string; method: string }>
}

test('(c) Carta: sin Divisa configurada "Efectivo USD" no es la opción Bs; con Divisa → "$ Divisa" y "Bs"', async () => {
  sql(`UPDATE businesses SET catalog_template='carta', settings=JSON_REMOVE(COALESCE(settings,JSON_OBJECT()),'$.catalog_divisa_methods') WHERE id=${BID}`)

  // catalog_divisa_methods vacío y Efectivo USD primero en el orden: la opción Bs es el Pago Móvil, nunca el efectivo
  const sin = await payOptions()
  expect(JSON.stringify(sin)).not.toContain('Efectivo USD')
  expect(sin.map(o => o.kind)).toEqual(['bs'])
  expect([sin[0].label, sin[0].method]).toEqual([M_BS, M_BS])

  // sin ningún método Bs real: etiqueta genérica y método "Bs" (no se inventa otro tipo de método)
  sql(`UPDATE payment_methods SET is_active=0 WHERE business_id=${BID} AND name<>'${M_USD}'`)
  const generica = await payOptions()
  expect(JSON.stringify(generica)).not.toContain('Efectivo USD')
  expect([generica[0].kind, generica[0].label, generica[0].method]).toEqual(['bs', 'Bs · tasa BCV', 'Bs'])

  // con Divisa configurada (Efectivo USD marcado): "$ Divisa" primero y "Bs" después
  sql(`UPDATE payment_methods SET is_active=1 WHERE business_id=${BID} AND name IN ('${M_USD}','${M_BS}')`)
  sql(`UPDATE businesses SET settings=JSON_SET(settings,'$.catalog_divisa_methods',JSON_ARRAY(${idOf(M_USD)})) WHERE id=${BID}`)
  const con = await payOptions()
  expect(con.map(o => o.kind)).toEqual(['divisa', 'bs'])
  expect(con[0]).toMatchObject({ label: '$ Divisa', method: M_USD })
  expect([con[1].label, con[1].method]).toEqual([M_BS, M_BS])
})

function metodos(bizId: number): Array<{ name: string; id: number; active: number }> {
  return sql(`SELECT CONCAT(id,'|',is_active,'|',name) FROM payment_methods WHERE business_id=${bizId} ORDER BY sort_order,id`).split(/\r?\n/).map(l => l.trim()).filter(Boolean) // mysql en Windows devuelve CRLF
    .map(l => { const [id, active, ...n] = l.split('|'); return { id: Number(id), active: Number(active), name: n.join('|').trim() } })
}
const divisaDe = (bizId: number): number[] => JSON.parse(sql(`SELECT IFNULL(JSON_EXTRACT(settings,'$.catalog_divisa_methods'),'[]') FROM businesses WHERE id=${bizId}`)) as number[]

test('(d) tenant nuevo de plantilla carta: catalog_divisa_methods con Efectivo USD y Zelle; Efectivo Bs inactivo', async () => {
  const email = `zza-pg-${TAG}@zza.test`
  const r = await sa.post('/api/admin/tenants', { data: {
    business_name: `ZZA Pagos ${TAG}`, slug: `zza-pg-${TAG}`, rubro: 'cafeteria', template: 'carta',
    collect_in: 'both', cashea: false, divisa: true, admin_name: 'ZZA Admin', admin_email: email,
  } })
  expect(r.status(), await r.text()).toBe(201)
  const bizId = ((await r.json()) as { business_id: number }).business_id
  toDelete.push(bizId)
  const m = metodos(bizId)
  const id = (n: string): number => m.find(x => x.name === n)!.id
  expect(divisaDe(bizId).sort((a, b) => a - b)).toEqual([id('Efectivo USD'), id('Zelle')].sort((a, b) => a - b))
  expect(m.find(x => x.name === 'Efectivo Bs')?.active, 'Efectivo Bs nace inactivo').toBe(0)
  for (const n of ['Efectivo USD', 'Pago Móvil', 'Zelle']) expect(m.find(x => x.name === n)?.active, n).toBe(1)
  // la plantilla y el resto de settings siguen ahí (el merge no pisó nada)
  expect(sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(settings,'$.cobro_precios.collect_in')) FROM businesses WHERE id=${bizId}`)).toBe('both')
})

test('(e) wizard eligiendo efectivo_bs (y Binance): Efectivo Bs queda activo y Binance entra en Divisa', async () => {
  // createTenant se llama directo (la ruta pública de onboarding manda correos reales); el cliente Prisma lee DB_* del .env
  for (const k of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) { try { process.env[k] ??= envValue(k) } catch { /* usa el default de src/lib/prisma */ } }
  const { createTenant } = await import('../src/lib/tenant-create')
  const email = `zza-pw-${TAG}@zza.test`
  const c = await createTenant({
    ownerName: 'ZZA Wizard', businessName: `ZZA Wizard ${TAG}`, slug: `zza-pw-${TAG}`, email, password: 'ZzaClave12345', businessType: 'boutique',
    paymentMethods: [{ type: 'efectivo_bs' }, { type: 'binance', detail: 'zza-binance' }],
  })
  expect(c.ok, JSON.stringify(c)).toBe(true)
  if (!c.ok) return
  toDelete.push(c.business.id)
  const m = metodos(c.business.id)
  const id = (n: string): number => m.find(x => x.name === n)!.id
  expect(m.find(x => x.name === 'Efectivo Bs')?.active, 'el wizard lo eligió → activo').toBe(1)
  expect(divisaDe(c.business.id).sort((a, b) => a - b)).toEqual([id('Efectivo USD'), id('Zelle'), id('Binance Pay / USDT')].sort((a, b) => a - b))

  // y sin efectivo_bs en el wizard queda inactivo (con Zelle, sin Binance)
  const sin = await createTenant({
    ownerName: 'ZZA Wizard', businessName: `ZZA Wizard2 ${TAG}`, slug: `zza-pw2-${TAG}`, email: `zza-pw2-${TAG}@zza.test`, password: 'ZzaClave12345', businessType: 'boutique',
    paymentMethods: [{ type: 'zelle', email: 'pagos@zza.test' }],
  })
  expect(sin.ok).toBe(true)
  if (!sin.ok) return
  toDelete.push(sin.business.id)
  const m2 = metodos(sin.business.id)
  expect(m2.find(x => x.name === 'Efectivo Bs')?.active).toBe(0)
  expect(divisaDe(sin.business.id)).toHaveLength(2) // Efectivo USD + Zelle
})
