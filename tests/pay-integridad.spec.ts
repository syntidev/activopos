import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Integridad de /pay: (1) propiedad de la venta, (2) amount_usd cuadra con amount_bs a la tasa de la venta,
 * (3) tasa única: total_bs y rate_used salen de la misma tasa (la del día si difiere de la guardada).
 * Negocio 80, servidor local, datos ZZ con limpieza; el cajero de la caja abierta se restaura al final.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BID = 80
const ADMIN_ID = 79
const OTRO_CAJERO_ID = 79001
const TAG = String(Date.now()).slice(-6)
const NAME = `ZZ Int ${TAG}`
const CREADOR = 'ZZ Int Creador'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let admin: APIRequestContext
let duenoCaja: APIRequestContext // cajero 79: abrió la caja
let otroCajero: APIRequestContext // cajero ajeno a la caja
let creador: APIRequestContext // cajero que crea las ventas (usuario ZZ)
let abriCaja = false
let cajeroOriginal = 0
let openedOriginal = ''
let registerId = 0
let productId = 0
let creadorId = 0
let metodo = 0

const token = (role: 'admin' | 'cashier', userId: number) =>
  new SignJWT({ userId, businessId: BID, role, name: 'ZZ Int' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

const ctx = async (role: 'admin' | 'cashier', userId: number) =>
  pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token(role, userId)}` } })

function limpiar(): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Int %'`).split('\n').filter(Boolean).join(',')
  if (ids) {
    const s = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${ids})`).split('\n').filter(Boolean).join(',')
    if (s) {
      sql(`DELETE FROM sale_payments WHERE sale_id IN (${s})`)
      sql(`DELETE FROM sale_items WHERE sale_id IN (${s})`)
      sql(`DELETE FROM sales WHERE business_id=${BID} AND id IN (${s})`)
    }
    sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
    sql(`DELETE FROM products WHERE business_id=${BID} AND id IN (${ids})`)
  }
  sql(`DELETE FROM users WHERE business_id=${BID} AND name='${CREADOR}'`)
}

async function crearPendiente(who: APIRequestContext): Promise<{ id: number; total_bs: number; rate: number }> {
  const r = await who.post('/api/sales', {
    data: { items: [{ product_id: productId, quantity: 1, sale_mode: 'unit', discount_usd: 0 }], status: 'pending', origin: 'pos' },
  })
  expect(r.status(), await r.text()).toBe(201)
  const id = ((await r.json()) as { sale: { id: number } }).sale.id
  return { id, total_bs: Number(sql(`SELECT total_bs FROM sales WHERE id=${id}`)), rate: Number(sql(`SELECT rate_used FROM sales WHERE id=${id}`)) }
}

const r2 = (x: number): number => Math.round(x * 100) / 100
const status = (id: number): string => sql(`SELECT status FROM sales WHERE id=${id}`)
const pagoExacto = (totalBs: number, rate: number) => [{ payment_method_id: metodo, amount_usd: r2(totalBs / rate), amount_bs: totalBs }]

test.beforeAll(async () => {
  limpiar()
  admin = await ctx('admin', ADMIN_ID)
  duenoCaja = await ctx('cashier', ADMIN_ID)
  otroCajero = await ctx('cashier', OTRO_CAJERO_ID)
  sql(`INSERT INTO users (business_id,name,email,password,role,is_active,created_at,updated_at) VALUES (${BID},'${CREADOR}','zz-int@example.invalid','x','cashier',1,NOW(3),NOW(3))`)
  creadorId = Number(sql(`SELECT id FROM users WHERE business_id=${BID} AND name='${CREADOR}'`))
  creador = await ctx('cashier', creadorId)
  if (Number(sql(`SELECT COUNT(*) FROM cash_registers WHERE business_id=${BID} AND closed_at IS NULL`)) === 0) {
    const open = await admin.post('/api/cash/open', { data: { opening_amount_usd: 0, opening_amount_bs: 0, close_notes: 'ZZ pay-integridad' } })
    expect(open.status(), await open.text()).toBe(201)
    abriCaja = true
  }
  registerId = Number(sql(`SELECT id FROM cash_registers WHERE business_id=${BID} AND closed_at IS NULL ORDER BY id DESC LIMIT 1`))
  cajeroOriginal = Number(sql(`SELECT cashier_id FROM cash_registers WHERE id=${registerId}`))
  openedOriginal = sql(`SELECT DATE_FORMAT(opened_at,'%Y-%m-%d %H:%i:%s.%f') FROM cash_registers WHERE id=${registerId}`)
  sql(`UPDATE cash_registers SET cashier_id=${ADMIN_ID}, opened_at=DATE_SUB(NOW(3), INTERVAL 1 DAY) WHERE id=${registerId}`)
  metodo = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BID} AND name='Efectivo USD'`))
  const p = await admin.post('/api/products', { data: { name: NAME, price_per_unit_usd: 10, cost_per_unit_usd: 2, is_fixed_price: true, stock_quantity: 50 } })
  expect(p.status(), await p.text()).toBe(201)
  productId = ((await p.json()) as { product: { id: number } }).product.id
})

test.afterAll(async () => {
  limpiar()
  if (abriCaja) await admin.post('/api/cash/close', { data: { closing_amount_usd: 0, closing_amount_bs: 0, close_notes: 'ZZ pay-integridad' } })
  else if (registerId) sql(`UPDATE cash_registers SET cashier_id=${cajeroOriginal}, opened_at='${openedOriginal}' WHERE id=${registerId}`)
  await admin?.dispose(); await duenoCaja?.dispose(); await otroCajero?.dispose(); await creador?.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Int %'`))).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM users WHERE business_id=${BID} AND name='${CREADOR}'`))).toBe(0)
})

test('1) propiedad: el cajero cobra lo suyo o lo de su caja abierta; lo ajeno da 403; otro negocio no existe', async () => {
  // Venta de otro cajero (usuario ZZ), creada DESPUÉS de abrir la caja de 79: 79 es el dueño de la caja → puede cobrarla.
  const a = await crearPendiente(creador)
  const ajeno = await otroCajero.patch(`/api/sales/${a.id}/pay`, { data: { payments: pagoExacto(a.total_bs, a.rate) } })
  expect(ajeno.status(), 'cajero que no es dueño ni de la caja').toBe(403)
  expect(status(a.id)).toBe('pending')
  const mia = await duenoCaja.patch(`/api/sales/${a.id}/pay`, { data: { payments: pagoExacto(a.total_bs, a.rate) } })
  expect(mia.status(), await mia.text()).toBe(200)

  // Venta anterior a la apertura de la caja: ya no es "de su caja" → 403 para el cajero, el admin sí la cobra.
  const b = await crearPendiente(creador)
  sql(`UPDATE sales SET created_at=DATE_SUB(NOW(3), INTERVAL 2 DAY) WHERE id=${b.id}`)
  const vieja = await duenoCaja.patch(`/api/sales/${b.id}/pay`, { data: { payments: pagoExacto(b.total_bs, b.rate) } })
  expect(vieja.status(), 'venta anterior a la caja abierta').toBe(403)
  expect(status(b.id)).toBe('pending')
  const adm = await admin.patch(`/api/sales/${b.id}/pay`, { data: { payments: pagoExacto(b.total_bs, b.rate) } })
  expect(adm.status(), await adm.text()).toBe(200)

  // Otro negocio: el aislamiento de tenant la oculta (404, sin revelar que existe) y no cambia nada.
  const foranea = Number(sql(`SELECT id FROM sales WHERE business_id<>${BID} AND status='paid' LIMIT 1`))
  expect(foranea).toBeGreaterThan(0)
  const antes = sql(`SELECT CONCAT(status,'|',total_usd) FROM sales WHERE id=${foranea}`)
  const x = await duenoCaja.patch(`/api/sales/${foranea}/pay`, { data: { payments: pagoExacto(10, 1) } })
  expect([403, 404]).toContain(x.status())
  expect(sql(`SELECT CONCAT(status,'|',total_usd) FROM sales WHERE id=${foranea}`)).toBe(antes)
})

test('2) montos: amount_usd debe cuadrar con amount_bs a la tasa de la venta', async () => {
  const v = await crearPendiente(duenoCaja)

  // Inflar amount_usd (para inventar vuelto) con amount_bs justo: no cuadra.
  const inflado = await duenoCaja.patch(`/api/sales/${v.id}/pay`, { data: { payments: [{ payment_method_id: metodo, amount_usd: 50, amount_bs: v.total_bs }] } })
  expect(inflado.status(), await inflado.text()).toBe(400)
  expect(((await inflado.json()) as { error: string }).error).toContain('no cuadran')
  // Una diferencia de 2 centavos de USD tampoco.
  const centavos = await duenoCaja.patch(`/api/sales/${v.id}/pay`, { data: { payments: [{ payment_method_id: metodo, amount_usd: r2(v.total_bs / v.rate) + 0.02, amount_bs: v.total_bs }] } })
  expect(centavos.status()).toBe(400)
  // Tope de pagos y de montos: mil pagos chicos o un monto absurdo no sirven para inflar la plata ni el vuelto.
  const muchos = await duenoCaja.patch(`/api/sales/${v.id}/pay`, { data: { payments: Array.from({ length: 11 }, () => ({ payment_method_id: metodo, amount_usd: 1, amount_bs: r2(v.rate) })) } })
  expect(muchos.status(), 'mas de 10 pagos').toBe(400)
  const enorme = await duenoCaja.patch(`/api/sales/${v.id}/pay`, { data: { payments: [{ payment_method_id: metodo, amount_usd: 1_000_000_000, amount_bs: r2(1_000_000_000 * v.rate) }] } })
  expect(enorme.status(), 'monto fuera de tope').toBe(400)
  expect(status(v.id)).toBe('pending')
  expect(status(v.id)).toBe('pending')

  // Pago mixto con cada pago consistente (uno en USD, otro en Bs con USD redondeado a centavos): se acepta.
  const usd1 = 4
  const bs1 = r2(usd1 * v.rate)
  const bs2 = r2(v.total_bs - bs1)
  const ok = await duenoCaja.patch(`/api/sales/${v.id}/pay`, {
    data: { payments: [{ payment_method_id: metodo, amount_usd: usd1, amount_bs: bs1 }, { payment_method_id: metodo, amount_usd: r2(bs2 / v.rate), amount_bs: bs2 }] },
  })
  expect(ok.status(), await ok.text()).toBe(200)
  expect(status(v.id)).toBe('paid')
})

test('3) tasa: total_bs y rate_used salen de la misma tasa; con tasa distinta se recalcula a la del día', async () => {
  // Sin cambio de tasa: nada se toca.
  const igual = await crearPendiente(duenoCaja)
  const antes = sql(`SELECT CONCAT(rate_used,'|',total_bs) FROM sales WHERE id=${igual.id}`)
  expect((await duenoCaja.patch(`/api/sales/${igual.id}/pay`, { data: { payments: pagoExacto(igual.total_bs, igual.rate) } })).status()).toBe(200)
  expect(sql(`SELECT CONCAT(rate_used,'|',total_bs) FROM sales WHERE id=${igual.id}`)).toBe(antes)

  // Venta guardada con una tasa vieja (10% menor): se cobra con la tasa del día y queda todo en esa misma tasa.
  const v = await crearPendiente(duenoCaja)
  const dia = v.rate
  const vieja = Math.round(dia * 0.9 * 10000) / 10000
  sql(`UPDATE sales SET rate_used=${vieja}, total_bs=ROUND(total_usd*${vieja},2) WHERE id=${v.id}`)
  sql(`UPDATE sale_items SET rate_used=${vieja}, subtotal_bs=ROUND(subtotal_usd*${vieja},2) WHERE sale_id=${v.id}`)

  // Pagar con montos de la tasa vieja ya no cuadra con la tasa del día.
  const tasaVieja = await duenoCaja.patch(`/api/sales/${v.id}/pay`, { data: { payments: pagoExacto(r2(10 * vieja), vieja) } })
  expect(tasaVieja.status(), await tasaVieja.text()).toBe(400)
  expect(status(v.id)).toBe('pending')

  const ok = await duenoCaja.patch(`/api/sales/${v.id}/pay`, { data: { payments: pagoExacto(r2(10 * dia), dia) } })
  expect(ok.status(), await ok.text()).toBe(200)
  const rateDb = Number(sql(`SELECT rate_used FROM sales WHERE id=${v.id}`))
  expect(Math.abs(rateDb - dia)).toBeLessThan(0.0001)
  const totalBs = Number(sql(`SELECT total_bs FROM sales WHERE id=${v.id}`))
  expect(totalBs).toBe(r2(10 * rateDb))
  expect(Number(sql(`SELECT COUNT(*) FROM sale_payments WHERE sale_id=${v.id} AND ABS(rate_used-${rateDb})>0.0001`))).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM sale_items WHERE sale_id=${v.id} AND (ABS(rate_used-${rateDb})>0.0001 OR ABS(subtotal_bs-ROUND(subtotal_usd*${rateDb},2))>0.011)`))).toBe(0)
})
