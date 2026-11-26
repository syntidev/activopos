import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { BASE, CAPTURAS, ensureBusiness, ensureUser, login, seedCarta, sql, type CartaSeed } from './helpers/restaurante-kds'

/**
 * Restaurante R4 — pedir cuenta, cobro (venta pendiente creada por el servidor + /pay sin tocar), dividir, propina, juntar y transferir.
 * Los 11 casos del PLAN. Solo activopos_kds.
 */

test.use({ storageState: { cookies: [], origins: [] }, baseURL: BASE })
test.describe.configure({ mode: 'serial' })

const R4 = path.join(CAPTURAS, 'r4')
const r2 = (n: number): number => Math.round(n * 100) / 100

let A = 0
let admin = 0, cashier = 0, cashier2 = 0, waiter = 0, waiter2 = 0
let carta: CartaSeed
let areaId = 0
let rate = 0
let pmUsd = 0, pmBs = 0, pmCard = 0, pmCashea = 0
let tableSeq = 100
const pool: Array<{ id: number; label: string }> = [] // mesas creadas por el admin; el cajero no toca la estructura

type Json = Record<string, unknown>
const call = (page: Page, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, data?: Json) => page.request.fetch(`${BASE}${url}`, { method, data })
const json = async <T>(r: Awaited<ReturnType<typeof call>>): Promise<T> => (await r.json()) as T

interface Acc { id: number; total_usd: number; status: string; items: Array<{ id: number; product_name: string }>; sales: Array<{ id: number; status: string; total_usd: number; tip_usd: number }> }
interface SaleRef { id: number; ticket_number: string; total_usd: number; total_bs: number; rate_used: number }
const as = async (role: 'admin' | 'cashier' | 'waiter', ctx: Parameters<typeof login>[0], uid: number) => login(ctx, A, role, uid)

/** Nueva mesa + cuenta con ítems ya enviados (sin estaciones: nacen listos). */
async function account(page: Page, items: Array<[number, number]>): Promise<Acc> {
  const t = pool.shift()
  if (!t) throw new Error('Sin mesas libres en el conjunto de prueba')
  lastLabel = t.label
  const acc = (await json<{ account: { id: number } }>(await call(page, 'POST', '/api/restaurante/cuentas', { table_id: t.id, guests: 2, waiter_id: waiter }))).account
  for (const [product_id, quantity] of items) expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/items`, { product_id, quantity })).status()).toBe(201)
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/enviar`, {})).status()).toBe(200)
  return get(page, acc.id)
}
const get = async (page: Page, id: number): Promise<Acc> => (await json<{ account: Acc }>(await call(page, 'GET', `/api/restaurante/cuentas/${id}`))).account
let lastLabel = ''
const bs = (usd: number): number => r2(usd * rate)
const pay = (page: Page, saleId: number, payments: Json[], extra: Json = {}) => call(page, 'PATCH', `/api/sales/${saleId}/pay`, { payments, ...extra })
const charge = async (page: Page, accId: number): Promise<SaleRef> => (await json<{ sales: SaleRef[] }>(await call(page, 'POST', `/api/restaurante/cuentas/${accId}/cobrar`, {}))).sales[0]
const cashStatus = async (page: Page) => (await json<{ turnoStats: { efectivoEsperado: number; totalVentasUsd: number } }>(await call(page, 'GET', '/api/cash/status'))).turnoStats

test.beforeAll(() => {
  A = ensureBusiness('zzkds-a', true)
  admin = ensureUser(A, 'admin', 'Admin R4')
  cashier = ensureUser(A, 'cashier', 'Cajera R4')
  cashier2 = ensureUser(A, 'cashier', 'Cajero Ajeno')
  waiter = ensureUser(A, 'waiter', 'Maria P')
  waiter2 = ensureUser(A, 'waiter', 'Luis R')
  carta = seedCarta(A)
  fs.mkdirSync(R4, { recursive: true })
  // Métodos de pago de prueba y UNA caja abierta (la de la cajera).
  const pm = (name: string, type: string, fin = 0): number => {
    if (!Number(sql(`SELECT COUNT(*) FROM payment_methods WHERE business_id=${A} AND name='${name}'`))) {
      sql(`INSERT INTO payment_methods (business_id,name,type,is_active,is_financing) VALUES (${A},'${name}','${type}',1,${fin})`)
    }
    return Number(sql(`SELECT id FROM payment_methods WHERE business_id=${A} AND name='${name}'`))
  }
  pmUsd = pm('ZZ Efectivo USD', 'cash'); pmBs = pm('ZZ Efectivo Bs', 'cash'); pmCard = pm('ZZ Tarjeta', 'card'); pmCashea = pm('ZZ Cashea', 'other', 1)
  sql(`UPDATE cash_registers SET closed_at = UTC_TIMESTAMP(3) WHERE business_id=${A} AND closed_at IS NULL`)
  sql(`INSERT INTO cash_registers (business_id,cashier_id,opening_amount_bs,opening_amount_usd,rate_at_open,opened_at) VALUES (${A},${cashier},0,0,36,UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE)`)
})

test('0 · preparación: salón y tasa activa', async ({ page, context }) => {
  await as('admin', context, admin)
  areaId = (await json<{ area: { id: number } }>(await call(page, 'POST', '/api/restaurante/areas', { name: 'Salón' }))).area.id
  for (let i = 0; i < 20; i++) {
    const label = String(++tableSeq)
    pool.push({ id: (await json<{ tables: Array<{ id: number }> }>(await call(page, 'POST', '/api/restaurante/mesas', { area_id: areaId, label, capacity: 4 }))).tables[0].id, label })
  }
  await as('cashier', context, cashier)
  rate = Math.round(Number((await json<{ rate: number }>(await call(page, 'GET', '/api/rates/bcv'))).rate) * 10000) / 10000
  expect(rate).toBeGreaterThan(0)
})

test('1 · pago mixto $10 efectivo + Bs por $20: 1 venta pagada, 2 pagos, stock descontado, cuenta cerrada y mesa por limpiar', async ({ page, context }) => {
  await as('cashier', context, cashier)
  const acc = await account(page, [[carta.pasta, 1], [carta.cerveza, 2]]) // 14 + 6 = 20
  expect(acc.total_usd).toBe(20)
  await as('waiter', context, waiter)
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/cobrar`, {})).status()).toBe(403) // el mesonero no cobra
  await as('cashier', context, cashier)

  const created = await json<{ sales: SaleRef[] }>(await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/cobrar`, {}))
  expect(created.sales).toHaveLength(1)
  const sale = created.sales[0]
  expect(sale.total_usd).toBe(20)
  expect(sql(`SELECT status FROM sales WHERE id=${sale.id}`)).toBe('pending')
  expect(sql(`SELECT COUNT(*) FROM sale_items WHERE sale_id=${sale.id} AND order_item_id IS NOT NULL`)).toBe('2')

  // Una cuenta con cobros ya no admite cambios de ítems.
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/items`, { product_id: carta.cerveza, quantity: 1 })).status()).toBe(409)

  const firstBs = bs(10)
  const res = await pay(page, sale.id, [
    { payment_method_id: pmUsd, amount_usd: 10, amount_bs: firstBs },
    { payment_method_id: pmBs, amount_usd: 10, amount_bs: r2(sale.total_bs - firstBs) },
  ])
  expect(res.status()).toBe(200)
  expect(sql(`SELECT status FROM sales WHERE id=${sale.id}`)).toBe('paid')
  expect(sql(`SELECT COUNT(*) FROM sale_payments WHERE sale_id=${sale.id}`)).toBe('2')
  expect(Number(sql(`SELECT COUNT(*) FROM inventory_entries WHERE business_id=${A} AND product_id=${carta.pasta} AND notes LIKE 'VENTA #${sale.ticket_number}%'`))).toBeGreaterThan(0)

  const sync = await json<{ closed: boolean; account: Acc }>(await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/sincronizar`, {}))
  expect(sync.closed).toBe(true)
  expect(sql(`SELECT account_status FROM orders WHERE id=${acc.id}`)).toBe('closed')
  const mesas = await json<{ tables: Array<{ id: number; status: string; label: string }> }>(await call(page, 'GET', '/api/restaurante/mesas'))
  expect(mesas.tables.find(t => t.label === lastLabel)?.status).toBe('por_limpiar')
  expect(sql(`SELECT COUNT(*) FROM table_events WHERE order_id=${acc.id} AND type='close'`)).toBe('1')
})

test('2 · dividir por ítems en 2 subcuentas: suma = total y la mesa cierra al pagar la última', async ({ page, context }) => {
  await as('cashier', context, cashier)
  const acc = await account(page, [[carta.pasta, 1], [carta.cerveza, 2], [carta.queso, 0.5]]) // 14 + 6 + 10 = 30
  const [pasta, cerveza, queso] = acc.items.map(i => i.id)
  const split = await json<{ sales: SaleRef[] }>(await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/dividir`, {
    kind: 'items', groups: [[{ item_id: pasta }], [{ item_id: cerveza }, { item_id: queso }]],
  }))
  expect(split.sales).toHaveLength(2)
  expect(r2(split.sales[0].total_usd + split.sales[1].total_usd)).toBe(acc.total_usd)
  expect(split.sales.map(s => s.total_usd)).toEqual([14, 16])

  const payAll = async (s: SaleRef) => pay(page, s.id, [{ payment_method_id: pmUsd, amount_usd: s.total_usd, amount_bs: s.total_bs }])
  expect((await payAll(split.sales[0])).status()).toBe(200)
  expect((await json<{ closed: boolean }>(await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/sincronizar`, {}))).closed).toBe(false)
  expect((await payAll(split.sales[1])).status()).toBe(200)
  expect((await json<{ closed: boolean }>(await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/sincronizar`, {}))).closed).toBe(true)

  // Un ítem ya cobrado no se puede volver a cobrar (la cuenta ya está cerrada).
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/dividir`, { kind: 'items', groups: [[{ item_id: pasta }]] })).status()).toBe(409)
})

test('3 · partes iguales entre 3: 1 venta y 3 pagos', async ({ page, context }) => {
  await as('cashier', context, cashier)
  const acc = await account(page, [[carta.pasta, 1], [carta.cerveza, 3]]) // 14 + 9 = 23
  const res = await json<{ sales: SaleRef[]; parts: Array<{ usd: number }> }>(await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/dividir`, { kind: 'equal', parts: 3 }))
  expect(res.sales).toHaveLength(1)
  expect(res.parts).toHaveLength(3)
  expect(r2(res.parts.reduce((a, p) => a + p.usd, 0))).toBe(23)
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/dividir`, { kind: 'equal', parts: 11 })).status()).toBe(400) // /pay admite 10 pagos

  const sale = res.sales[0]
  let acumulado = 0
  const payments = res.parts.map((p, i) => {
    const amount_bs = i === res.parts.length - 1 ? r2(sale.total_bs - acumulado) : bs(p.usd)
    acumulado = r2(acumulado + amount_bs)
    return { payment_method_id: pmUsd, amount_usd: p.usd, amount_bs }
  })
  expect((await pay(page, sale.id, payments)).status()).toBe(200)
  expect(sql(`SELECT COUNT(*) FROM sale_payments WHERE sale_id=${sale.id}`)).toBe('3')
})

test('4 · propina en efectivo sube el efectivo esperado; en tarjeta no; las ventas netas no cambian', async ({ page, context }) => {
  await as('cashier', context, cashier)
  const acc = await account(page, [[carta.pasta, 1]])
  const sale = await charge(page, acc.id)
  expect((await pay(page, sale.id, [{ payment_method_id: pmUsd, amount_usd: 14, amount_bs: sale.total_bs }])).status()).toBe(200)

  const before = await cashStatus(page)
  expect((await call(page, 'POST', '/api/restaurante/propinas', { sale_id: sale.id, payment_method_id: pmUsd, amount_usd: 2 })).status()).toBe(201)
  const afterCash = await cashStatus(page)
  expect(afterCash.totalVentasUsd).toBe(before.totalVentasUsd) // la propina NO es venta
  expect(afterCash.efectivoEsperado).toBeCloseTo(before.efectivoEsperado + bs(2), 1)

  expect((await call(page, 'POST', '/api/restaurante/propinas', { sale_id: sale.id, payment_method_id: pmCard, amount_usd: 5 })).status()).toBe(201)
  const afterCard = await cashStatus(page)
  expect(afterCard.efectivoEsperado).toBeCloseTo(afterCash.efectivoEsperado, 1) // tarjeta: no entra al cajón
  expect(afterCard.totalVentasUsd).toBe(before.totalVentasUsd)
  expect((await call(page, 'POST', '/api/restaurante/propinas', { sale_id: sale.id, payment_method_id: pmUsd, amount_usd: -1 })).status()).toBe(400)
  expect(sql(`SELECT ROUND(SUM(amount_usd),2) FROM sale_tips WHERE sale_id=${sale.id}`)).toBe('7.00')
  expect(sql(`SELECT total_usd FROM sales WHERE id=${sale.id}`)).toBe('14.00')
})

test('5 · Cashea: cédula exigida y no se cobra con financiador sin financiamiento aprobado', async ({ page, context }) => {
  await as('cashier', context, cashier)
  const acc = await account(page, [[carta.pasta, 1]])
  const sale = await charge(page, acc.id)
  const withCashea = [{ payment_method_id: pmCashea, amount_usd: 14, amount_bs: sale.total_bs }]
  expect((await pay(page, sale.id, withCashea)).status()).toBe(422) // sin cédula
  const withCedula = await pay(page, sale.id, withCashea, { client_cedula: 'V12345678' })
  expect(withCedula.status()).toBeGreaterThanOrEqual(400) // financiamiento no aprobado
  expect(sql(`SELECT status FROM sales WHERE id=${sale.id}`)).toBe('pending')
})

test('6 · juntar 2 mesas → 1 cuenta; transferir mesa y mesonero dejan TableEvent', async ({ page, context }) => {
  await as('admin', context, admin)
  const a = await account(page, [[carta.pasta, 1]])
  const b = await account(page, [[carta.cerveza, 2]])
  const bTable = Number(sql(`SELECT table_id FROM orders WHERE id=${b.id}`))
  const merged = await json<{ account: Acc & { joined_tables: string[] } }>(await call(page, 'POST', `/api/restaurante/cuentas/${a.id}/juntar`, { source_id: b.id }))
  expect(merged.account.items).toHaveLength(2)
  expect(merged.account.total_usd).toBe(20)
  expect(merged.account.joined_tables).toHaveLength(1)
  expect(sql(`SELECT account_status FROM orders WHERE id=${b.id}`)).toBe('void')
  const mesas = await json<{ tables: Array<{ id: number; status: string; account_id: number | null }> }>(await call(page, 'GET', '/api/restaurante/mesas'))
  const joined = mesas.tables.find(t => t.id === bTable)
  expect(joined?.status).toBe('ocupada')
  expect(joined?.account_id).toBe(a.id)
  expect(sql(`SELECT COUNT(*) FROM table_events WHERE order_id=${a.id} AND type='merge'`)).toBe('1')

  // Transferir a una mesa libre y a otro mesonero.
  const libre = (await json<{ tables: Array<{ id: number }> }>(await call(page, 'POST', '/api/restaurante/mesas', { area_id: areaId, label: String(++tableSeq), capacity: 2 }))).tables[0].id
  const busy = await call(page, 'POST', `/api/restaurante/cuentas/${a.id}/transferir`, { table_id: bTable })
  expect(busy.status()).toBe(409) // la mesa unida está ocupada
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${a.id}/transferir`, { table_id: libre, waiter_id: waiter2 })).status()).toBe(200)
  expect(sql(`SELECT COUNT(*) FROM table_events WHERE order_id=${a.id} AND type IN ('transfer_table','transfer_waiter')`)).toBe('2')
  expect(sql(`SELECT waiter_id FROM orders WHERE id=${a.id}`)).toBe(String(waiter2))
})

test('7 · devolución posterior sobre una venta de mesa: las ventas netas reflejan la devolución', async ({ page, context }) => {
  await as('admin', context, admin)
  const acc = await account(page, [[carta.pasta, 1], [carta.cerveza, 2]])
  const sale = await charge(page, acc.id)
  expect((await pay(page, sale.id, [{ payment_method_id: pmUsd, amount_usd: 20, amount_bs: sale.total_bs }])).status()).toBe(200)
  const before = await cashStatus(page)
  const saleItem = Number(sql(`SELECT id FROM sale_items WHERE sale_id=${sale.id} AND product_id=${carta.cerveza}`))
  const ret = await call(page, 'POST', '/api/returns', { sale_id: sale.id, items: [{ product_id: carta.cerveza, qty: 1, sale_item_id: saleItem }], reason: 'cliente cambió', refund_payment_method_id: pmUsd })
  expect([200, 201]).toContain(ret.status())
  const after = await cashStatus(page)
  expect(after.totalVentasUsd).toBe(r2(before.totalVentasUsd - 3)) // la devolución resta de las ventas netas, igual que cualquier venta
})

test('8 · reabrir solo admin; cancelar un cobro pendiente la reabre; sin caja abierta no se cobra', async ({ page, context }) => {
  await as('cashier', context, cashier)
  const acc = await account(page, [[carta.pasta, 1]])
  const sale = await charge(page, acc.id)
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/reabrir`, {})).status()).toBe(403) // el cajero no reabre
  await as('admin', context, admin)
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/reabrir`, { reason: 'error de cobro' })).status()).toBe(200)
  expect(sql(`SELECT status FROM sales WHERE id=${sale.id}`)).toBe('cancelled')
  expect(sql(`SELECT account_status FROM orders WHERE id=${acc.id}`)).toBe('open')
  expect(sql(`SELECT COUNT(*) FROM table_events WHERE order_id=${acc.id} AND type='reopen'`)).toBe('1')
  // Con una venta pagada hay que anularla primero.
  const again = await charge(page, acc.id)
  expect((await pay(page, again.id, [{ payment_method_id: pmUsd, amount_usd: 14, amount_bs: again.total_bs }])).status()).toBe(200)
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/reabrir`, {})).status()).toBe(409)

  // Sin caja abierta: mismo bloqueo del POS.
  const acc2 = await account(page, [[carta.pasta, 1]])
  sql(`UPDATE cash_registers SET closed_at = UTC_TIMESTAMP(3) WHERE business_id=${A} AND closed_at IS NULL`)
  const blocked = await call(page, 'POST', `/api/restaurante/cuentas/${acc2.id}/cobrar`, {})
  expect(blocked.status()).toBe(409)
  expect((await json<{ code: string }>(blocked)).code).toBe('CAJA_CERRADA')
  sql(`INSERT INTO cash_registers (business_id,cashier_id,opening_amount_bs,opening_amount_usd,rate_at_open,opened_at) VALUES (${A},${cashier},0,0,36,UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE)`)
})

test('9 · integridad con el /pay actual: cargo/descuento del body se descartan, montos que no cuadran, >10 pagos y cajero ajeno', async ({ page, context }) => {
  await as('cashier', context, cashier)
  const acc = await account(page, [[carta.pasta, 1]])
  const sale = await charge(page, acc.id)
  const ok = { payment_method_id: pmUsd, amount_usd: 14, amount_bs: sale.total_bs }
  expect((await pay(page, sale.id, [{ ...ok, amount_bs: r2(sale.total_bs * 2) }])).status()).toBe(400) // no cuadra con la tasa
  const many = Array.from({ length: 11 }, () => ({ payment_method_id: pmUsd, amount_usd: 1.28, amount_bs: bs(1.28) }))
  expect((await pay(page, sale.id, many)).status()).toBe(400) // más de 10 pagos

  await as('cashier', context, cashier2)
  expect((await pay(page, sale.id, [ok])).status()).toBe(403) // cajero ajeno a la venta

  await as('cashier', context, cashier)
  // cargo_pct y discount_pct en el body se descartan: el total sigue siendo el guardado.
  const res = await pay(page, sale.id, [ok], { cargo_pct: 50, discount_pct: 50 })
  expect(res.status()).toBe(200)
  expect(sql(`SELECT total_usd FROM sales WHERE id=${sale.id}`)).toBe('14.00')
  expect(sql(`SELECT cargo_pct FROM sales WHERE id=${sale.id}`)).toBe('0')
})

test('10 · /cargo sobre la venta de mesa recalcula el total en servidor', async ({ page, context }) => {
  await as('cashier', context, cashier)
  const acc = await account(page, [[carta.pasta, 1], [carta.cerveza, 2]]) // 20
  const sale = await charge(page, acc.id)
  const res = await call(page, 'PATCH', `/api/sales/${sale.id}/cargo`, { cargo_pct: 10 })
  expect(res.status()).toBe(200)
  expect(sql(`SELECT total_usd FROM sales WHERE id=${sale.id}`)).toBe('22.00')
  expect(sql(`SELECT total_bs FROM sales WHERE id=${sale.id}`)).toBe(r2(22 * rate).toFixed(2))
  // Aun con cargo, la cuenta de la mesa conserva su total sin cargo.
  expect((await get(page, acc.id)).total_usd).toBe(20)
})

test('11 · el waiter recibe 403 en /pay, /cargo y /api/sales', async ({ page, context }) => {
  await as('cashier', context, cashier)
  const acc = await account(page, [[carta.pasta, 1]])
  const sale = await charge(page, acc.id)
  await as('waiter', context, waiter)
  const pagos = [{ payment_method_id: pmUsd, amount_usd: 14, amount_bs: sale.total_bs }]
  expect((await pay(page, sale.id, pagos)).status()).toBe(403)
  expect((await call(page, 'PATCH', `/api/sales/${sale.id}/cargo`, { cargo_pct: 5 })).status()).toBe(403)
  expect((await call(page, 'GET', '/api/sales')).status()).toBe(403)
  expect((await call(page, 'POST', '/api/restaurante/propinas', { sale_id: sale.id, payment_method_id: pmUsd, amount_usd: 1 })).status()).toBe(403)
  // Pedir cuenta sí es del mesonero.
  await as('cashier', context, cashier)
  const acc2 = await account(page, [[carta.pasta, 1]])
  await as('waiter', context, waiter)
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc2.id}/pedir-cuenta`, {})).status()).toBe(200)
  expect(sql(`SELECT account_status FROM orders WHERE id=${acc2.id}`)).toBe('bill_requested')
  // Pedir algo más reabre la cuenta.
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc2.id}/items`, { product_id: carta.cerveza, quantity: 1 })).status()).toBe(201)
  expect(sql(`SELECT account_status FROM orders WHERE id=${acc2.id}`)).toBe('open')
})

test('capturas · cobro a 1280 y 375', async ({ page, context }) => {
  await as('cashier', context, cashier)
  const acc = await account(page, [[carta.pasta, 1], [carta.cerveza, 2], [carta.queso, 0.5]])
  for (const vp of [{ w: 1280, h: 900 }, { w: 375, h: 800 }]) {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await page.goto(`/restaurante/cuenta/${acc.id}`)
    await expect(page.getByRole('button', { name: 'Cobrar', exact: true })).toBeVisible({ timeout: 8_000 })
    await page.screenshot({ path: path.join(R4, `cuenta-acciones-${vp.w}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Cobrar', exact: true }).click()
    await expect(page.getByRole('dialog').getByText('Por cobrar')).toBeVisible()
    await page.waitForTimeout(500) // la hoja termina de animarse
    await page.screenshot({ path: path.join(R4, `pre-cuenta-${vp.w}.png`), fullPage: true })
    await page.getByRole('dialog').getByRole('button', { name: 'Dividir' }).click()
    await expect(page.getByRole('radio', { name: 'Por ítems' })).toBeVisible()
    await page.getByLabel(/Subcuenta de ZZ Cerveza/).selectOption('1')
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(R4, `dividir-${vp.w}.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  // Una venta cobrada con propina: se ve en la cuenta.
  await page.setViewportSize({ width: 375, height: 800 })
  const acc2 = await account(page, [[carta.pasta, 1]])
  const sale = await charge(page, acc2.id)
  await pay(page, sale.id, [{ payment_method_id: pmUsd, amount_usd: 14, amount_bs: sale.total_bs }])
  await call(page, 'POST', '/api/restaurante/propinas', { sale_id: sale.id, payment_method_id: pmUsd, amount_usd: 2 })
  await page.goto(`/restaurante/cuenta/${acc2.id}`)
  await expect(page.getByText(/Pagada/)).toBeVisible({ timeout: 8_000 })
  await page.screenshot({ path: path.join(R4, 'cuenta-cobrada-375.png'), fullPage: true })
})

test('hallazgos de seguridad · porciones sin deriva ni subtotal 0, propina acotada, venta de mesa sin re-precio y mesonero sin reasignar', async ({ page, context }) => {
  await as('cashier', context, cashier)
  const acc = await account(page, [[carta.cerveza, 3]]) // 9.00
  const item = acc.items[0].id
  // Una porción diminuta (0.001 × $3 = $0.00) no se cobra.
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/dividir`, { kind: 'items', groups: [[{ item_id: item, quantity: 0.001 }], [{ item_id: item, quantity: 2.999 }]] })).status()).toBe(422)
  // Tres porciones de 1 unidad suman EXACTAMENTE el subtotal de la línea.
  const split = await json<{ sales: SaleRef[] }>(await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/dividir`, { kind: 'items', groups: [[{ item_id: item, quantity: 1 }], [{ item_id: item, quantity: 1 }], [{ item_id: item, quantity: 1 }]] }))
  expect(r2(split.sales.reduce((a, s) => a + s.total_usd, 0))).toBe(9)
  expect(sql(`SELECT ROUND(SUM(subtotal_usd),2) FROM sale_items WHERE order_item_id=${item}`)).toBe('9.00')

  // Propina: solo sobre venta cobrada, sin pasar del total y sin doble clic.
  const s0 = split.sales[0]
  expect((await call(page, 'POST', '/api/restaurante/propinas', { sale_id: s0.id, payment_method_id: pmUsd, amount_usd: 1 })).status()).toBe(409) // aún pendiente
  expect((await pay(page, s0.id, [{ payment_method_id: pmUsd, amount_usd: s0.total_usd, amount_bs: s0.total_bs }])).status()).toBe(200)
  expect((await call(page, 'POST', '/api/restaurante/propinas', { sale_id: s0.id, payment_method_id: pmUsd, amount_usd: 50 })).status()).toBe(422) // más que el total
  expect((await call(page, 'POST', '/api/restaurante/propinas', { sale_id: s0.id, payment_method_id: pmUsd, amount_usd: 1 })).status()).toBe(201)
  expect((await call(page, 'POST', '/api/restaurante/propinas', { sale_id: s0.id, payment_method_id: pmUsd, amount_usd: 1 })).status()).toBe(409) // doble clic

  // Una venta de mesa no se re-precia desde el catálogo.
  expect((await call(page, 'PATCH', `/api/sales/${split.sales[1].id}/price-mode`, { price_mode: 'divisa' })).status()).toBe(409)

  // El mesonero no reasigna mesoneros.
  await as('waiter', context, waiter)
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${acc.id}/transferir`, { waiter_id: waiter2 })).status()).toBe(403)
})

test('las ventas de mesa pendientes no aparecen en las listas del POS', async ({ page, context }) => {
  await as('cashier', context, cashier)
  const acc = await account(page, [[carta.pasta, 1]])
  const sale = await charge(page, acc.id)
  const list = async (url: string) => (await json<{ sales: Array<{ id: number }> }>(await call(page, 'GET', url))).sales.map(s => s.id)
  expect(await list('/api/sales?status=pending&limit=100')).not.toContain(sale.id)
  expect(await list('/api/sales?limit=100')).not.toContain(sale.id)
  expect((await pay(page, sale.id, [{ payment_method_id: pmUsd, amount_usd: 14, amount_bs: sale.total_bs }])).status()).toBe(200)
  expect(await list('/api/sales?limit=100')).toContain(sale.id) // ya cobrada, sí es una venta más
})

test('recibo: mesa, mesonero y propina (aparte del total) en ticket-data y en el ticket impreso', async ({ page, context }) => {
  await as('cashier', context, cashier)
  const acc = await account(page, [[carta.pasta, 1]])
  const sale = await charge(page, acc.id)
  expect((await pay(page, sale.id, [{ payment_method_id: pmUsd, amount_usd: 14, amount_bs: sale.total_bs }])).status()).toBe(200)
  expect((await call(page, 'POST', '/api/restaurante/propinas', { sale_id: sale.id, payment_method_id: pmUsd, amount_usd: 3 })).status()).toBe(201)
  const data = await json<{ ticket: { sale: { total_usd: number; table: { label: string; waiter_name: string } | null; tips: Array<{ amount_usd: number; amount_bs: number; method: string }> } } }>(await call(page, 'GET', `/api/sales/${sale.id}/ticket-data`))
  expect(data.ticket.sale.total_usd).toBe(14) // la propina NO suma al total
  expect(data.ticket.sale.table?.label).toBe(lastLabel)
  expect(data.ticket.sale.table?.waiter_name).toBe('Maria P')
  expect(data.ticket.sale.tips).toEqual([{ method: 'ZZ Efectivo USD', amount_usd: 3, amount_bs: bs(3) }])
  const html = await (await call(page, 'GET', `/api/sales/${sale.id}/ticket`)).text()
  expect(html).toContain(`Mesa: ${lastLabel}`)
  expect(html).toContain('Mesonero: Maria P')
  expect(html).toContain('PROPINA')
  // Una venta que no es de mesa no cambia: sin Mesa ni Propina.
  const normal = Number(sql(`SELECT id FROM sales WHERE business_id=${A} AND table_order_id IS NULL ORDER BY id DESC LIMIT 1`))
  if (normal > 0) {
    const h2 = await (await call(page, 'GET', `/api/sales/${normal}/ticket`)).text()
    expect(h2).not.toContain('PROPINA')
  }
})
