import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { BASE, CAPTURAS, ensureBusiness, ensureUser, login, seedCarta, sql, type CartaSeed } from './helpers/restaurante-kds'

/**
 * Restaurante R5 — reportes: ventas netas por mesonero y área (sales-returns.ts), propinas aparte, rotación, tiempos por estación p50/p90,
 * exportación CSV (propinas en su propia sección) y la página a 1280 y 375. Solo activopos_kds.
 */

test.use({ storageState: { cookies: [], origins: [] }, baseURL: BASE })
test.describe.configure({ mode: 'serial' })

const R5 = path.join(CAPTURAS, 'r5')
const r2 = (n: number): number => Math.round(n * 100) / 100

let A = 0, E = 0
let admin = 0, cashier = 0, w1 = 0, w2 = 0
let carta: CartaSeed
let salon = 0, terraza = 0
let cocina = 0
let rate = 0
let pmUsd = 0, pmCard = 0
const accounts: Record<string, number> = {}

type Json = Record<string, unknown>
const call = (page: Page, method: 'GET' | 'POST' | 'PATCH', url: string, data?: Json) => page.request.fetch(`${BASE}${url}`, { method, data })
const json = async <T>(r: Awaited<ReturnType<typeof call>>): Promise<T> => (await r.json()) as T
const as = (ctx: Parameters<typeof login>[0], role: 'admin' | 'cashier' | 'waiter', uid: number) => login(ctx, A, role, uid)

interface SaleRef { id: number; total_usd: number; total_bs: number }

/** Cuenta cobrada y cerrada: mesonero, área, ítems y propina opcional. */
async function sold(page: Page, ctx: Parameters<typeof login>[0], key: string, area: number, waiter: number, items: Array<[number, number]>, tip?: { method: number; usd: number }): Promise<void> {
  await as(ctx, 'admin', admin)
  const t = (await json<{ tables: Array<{ id: number }> }>(await call(page, 'POST', '/api/restaurante/mesas', { area_id: area, label: key, capacity: 4 }))).tables[0].id
  const id = (await json<{ account: { id: number } }>(await call(page, 'POST', '/api/restaurante/cuentas', { table_id: t, guests: 2, waiter_id: waiter }))).account.id
  for (const [product_id, quantity] of items) await call(page, 'POST', `/api/restaurante/cuentas/${id}/items`, { product_id, quantity })
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${id}/enviar`, {})).status()).toBe(200)
  await as(ctx, 'cashier', cashier)
  const sale = (await json<{ sales: SaleRef[] }>(await call(page, 'POST', `/api/restaurante/cuentas/${id}/cobrar`, {}))).sales[0]
  expect((await call(page, 'PATCH', `/api/sales/${sale.id}/pay`, { payments: [{ payment_method_id: pmUsd, amount_usd: sale.total_usd, amount_bs: sale.total_bs }] })).status()).toBe(200)
  if (tip) expect((await call(page, 'POST', '/api/restaurante/propinas', { sale_id: sale.id, payment_method_id: tip.method, amount_usd: tip.usd })).status()).toBe(201)
  expect((await call(page, 'POST', `/api/restaurante/cuentas/${id}/sincronizar`, {})).status()).toBe(200)
  accounts[key] = id
}

test.beforeAll(() => {
  A = ensureBusiness('zzkds-a', true)
  E = ensureBusiness('zzkds-e', false)
  admin = ensureUser(A, 'admin', 'Admin R5')
  cashier = ensureUser(A, 'cashier', 'Cajera R5')
  w1 = ensureUser(A, 'waiter', 'Maria P')
  w2 = ensureUser(A, 'waiter', 'Luis R')
  carta = seedCarta(A)
  fs.mkdirSync(R5, { recursive: true })
  const pm = (name: string, type: string): number => {
    if (!Number(sql(`SELECT COUNT(*) FROM payment_methods WHERE business_id=${A} AND name='${name}'`))) sql(`INSERT INTO payment_methods (business_id,name,type,is_active,is_financing) VALUES (${A},'${name}','${type}',1,0)`)
    return Number(sql(`SELECT id FROM payment_methods WHERE business_id=${A} AND name='${name}'`))
  }
  pmUsd = pm('ZZ Efectivo USD', 'cash'); pmCard = pm('ZZ Tarjeta', 'card')
  sql(`UPDATE cash_registers SET closed_at = UTC_TIMESTAMP(3) WHERE business_id=${A} AND closed_at IS NULL`)
  sql(`INSERT INTO cash_registers (business_id,cashier_id,opening_amount_bs,opening_amount_usd,rate_at_open,opened_at) VALUES (${A},${cashier},0,0,36,UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE)`)
})

test('0 · preparación: áreas, estación y cuentas cobradas por dos mesoneros', async ({ page, context }) => {
  await as(context, 'admin', admin)
  salon = (await json<{ area: { id: number } }>(await call(page, 'POST', '/api/restaurante/areas', { name: 'Salón' }))).area.id
  terraza = (await json<{ area: { id: number } }>(await call(page, 'POST', '/api/restaurante/areas', { name: 'Terraza' }))).area.id
  cocina = (await json<{ station: { id: number } }>(await call(page, 'POST', '/api/restaurante/estaciones', { name: 'Cocina', warn_min: 10, critical_min: 20 }))).station.id
  await as(context, 'cashier', cashier)
  rate = Math.round(Number((await json<{ rate: number }>(await call(page, 'GET', '/api/rates/bcv'))).rate) * 10000) / 10000

  await sold(page, context, '1', salon, w1, [[carta.pasta, 1]], { method: pmUsd, usd: 2 })                               // 14 · propina efectivo 2
  await sold(page, context, '2', terraza, w1, [[carta.pasta, 1], [carta.cerveza, 2]], { method: pmCard, usd: 3 })         // 20 · propina tarjeta 3
  await sold(page, context, '3', salon, w2, [[carta.cerveza, 3]])                                                         // 9 → 6 tras devolver 1 cerveza

  await as(context, 'admin', admin)
  const sale3 = Number(sql(`SELECT id FROM sales WHERE table_order_id=${accounts['3']}`))
  const line = Number(sql(`SELECT id FROM sale_items WHERE sale_id=${sale3}`))
  const ret = await call(page, 'POST', '/api/returns', { sale_id: sale3, items: [{ product_id: carta.cerveza, qty: 1, sale_item_id: line }], reason: 'cliente cambió', refund_payment_method_id: pmUsd })
  expect([200, 201]).toContain(ret.status())

  // Duración de cada cuenta (30/60/90 min) y tiempos de cocina conocidos (espera 1,2,3,4,10 · preparación 5).
  sql(`UPDATE orders SET opened_at = closed_at - INTERVAL 30 MINUTE WHERE id=${accounts['1']}`)
  sql(`UPDATE orders SET opened_at = closed_at - INTERVAL 60 MINUTE WHERE id=${accounts['2']}`)
  sql(`UPDATE orders SET opened_at = closed_at - INTERVAL 90 MINUTE WHERE id=${accounts['3']}`)
  for (const wait of [1, 2, 3, 4, 10]) {
    sql(`INSERT INTO order_items (order_id,product_id,product_name,quantity,price_per_unit_usd,subtotal_usd,station_id,kds_status,sent_at,started_at,ready_at)
         VALUES (${accounts['1']},${carta.pasta},'ZZ Pasta carbonara',1,14,14,${cocina},'served',UTC_TIMESTAMP(3) - INTERVAL 40 MINUTE,UTC_TIMESTAMP(3) - INTERVAL ${40 - wait} MINUTE,UTC_TIMESTAMP(3) - INTERVAL ${35 - wait} MINUTE)`)
  }
})

interface Report {
  net_sales: { total: { usd: number; bs: number }; sales: number; by_waiter: Array<{ name: string; sales: number; net: { usd: number; bs: number } }>; by_area: Array<{ name: string; sales: number; net: { usd: number } }> }
  rotation: { closed_accounts: number; avg_minutes: number | null; by_area: Array<{ area: string; closed: number; avg_minutes: number | null }> }
  stations: Array<{ name: string; items: number; wait_p50: number; wait_p90: number; prep_p50: number; prep_p90: number; total_p50: number; total_p90: number }>
  tips: { total: { usd: number }; cash: { usd: number }; other: { usd: number }; by_waiter: Array<{ name: string; count: number; cash: { usd: number }; other: { usd: number }; total: { usd: number } }> }
}
const report = async (page: Page): Promise<Report> => (await json<{ report: Report }>(await call(page, 'GET', '/api/restaurante/reportes'))).report

test('ventas netas por mesonero y área (con la devolución) y SIN propinas', async ({ page, context }) => {
  await as(context, 'admin', admin)
  const r = await report(page)
  expect(r.net_sales.total.usd).toBe(40) // 14 + 20 + (9 − 3); las propinas ($5) NO suman
  expect(r.net_sales.total.bs).toBeCloseTo(40 * rate, 0)
  expect(r.net_sales.sales).toBe(3)
  expect(r.net_sales.by_waiter.map(w => [w.name, w.sales, w.net.usd])).toEqual([['Maria P', 2, 34], ['Luis R', 1, 6]])
  const areas = Object.fromEntries(r.net_sales.by_area.map(a => [a.name, [a.sales, a.net.usd]]))
  expect(areas).toEqual({ Terraza: [1, 20], 'Salón': [2, 20] }) // Salón: 14 + 6 (neto de la devolución)
})

test('propinas por mesonero: efectivo y otros métodos por separado', async ({ page, context }) => {
  await as(context, 'admin', admin)
  const r = await report(page)
  expect(r.tips.by_waiter).toHaveLength(1) // Luis no recibió propinas
  const maria = r.tips.by_waiter[0]
  expect([maria.name, maria.count, maria.cash.usd, maria.other.usd, maria.total.usd]).toEqual(['Maria P', 2, 2, 3, 5])
  expect([r.tips.total.usd, r.tips.cash.usd, r.tips.other.usd]).toEqual([5, 2, 3])
})

test('rotación (cuentas cerradas y duración) y tiempos por estación p50/p90', async ({ page, context }) => {
  await as(context, 'admin', admin)
  const r = await report(page)
  expect(r.rotation.closed_accounts).toBe(3)
  expect(r.rotation.avg_minutes).toBeCloseTo(60, 0)
  expect(r.rotation.by_area.find(a => a.area === 'Salón')).toMatchObject({ closed: 2 })
  const cocinaRow = r.stations.find(s => s.name === 'Cocina')
  expect(cocinaRow?.items).toBe(5)
  expect([cocinaRow?.wait_p50, cocinaRow?.wait_p90]).toEqual([3, 10])   // espera 1,2,3,4,10
  expect([cocinaRow?.prep_p50, cocinaRow?.prep_p90]).toEqual([5, 5])
  expect([cocinaRow?.total_p50, cocinaRow?.total_p90]).toEqual([8, 15]) // 6,7,8,9,15
})

test('el reporte es de admin, valida el rango y no existe sin el módulo', async ({ page, context }) => {
  await as(context, 'cashier', cashier)
  expect((await call(page, 'GET', '/api/restaurante/reportes')).status()).toBe(403)
  await as(context, 'waiter', w1)
  expect((await call(page, 'GET', '/api/restaurante/reportes')).status()).toBe(403)
  await as(context, 'admin', admin)
  expect((await call(page, 'GET', '/api/restaurante/reportes?from=2026-12-31&to=2026-01-01')).status()).toBe(400)
  expect((await call(page, 'GET', '/api/restaurante/reportes?from=hoy')).status()).toBe(400)
  expect((await call(page, 'GET', '/api/restaurante/reportes?from=2024-01-01&to=2026-11-01')).status()).toBe(400) // más de 366 días
  await login(context, E, 'admin', ensureUser(E, 'admin', 'Admin E'))
  expect((await call(page, 'GET', '/api/restaurante/reportes')).status()).toBe(404) // sin flag
})

test('CSV: propinas en su propia sección, aparte de las ventas', async ({ page, context }) => {
  await as(context, 'admin', admin)
  const res = await call(page, 'GET', '/api/restaurante/reportes/export?format=csv')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('text/csv')
  expect(res.headers()['content-disposition']).toContain('restaurante-')
  const csv = await res.text()
  expect(csv.charCodeAt(0)).toBe(0xFEFF)
  const ventas = csv.indexOf('VENTAS NETAS (sin propinas)')
  const propinas = csv.indexOf('PROPINAS (aparte de las ventas)')
  expect(ventas).toBeGreaterThan(-1)
  expect(propinas).toBeGreaterThan(ventas)
  expect(csv.slice(ventas, propinas)).not.toContain('Total propinas')
  expect(csv).toContain('Maria P,2,2,')              // propinas de María: 2 propinas, $2 en efectivo…
  expect(csv).toContain('Total propinas,,2,')
  expect(csv).toContain('Todas,3,40,')                // 3 ventas, $40 netos
  expect(csv).toContain('Cocina,5,3,10,5,5,8,15')    // tiempos p50/p90 de la estación
})

test('capturas · reportes a 1280 y 375 y descarga de PDF', async ({ page, context }) => {
  await as(context, 'admin', admin)
  for (const vp of [{ w: 1280, h: 900 }, { w: 375, h: 800 }]) {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await page.goto('/restaurante/reportes')
    await expect(page.getByRole('heading', { name: 'Reportes del restaurante' })).toBeVisible({ timeout: 8_000 })
    await expect(page.getByLabel('Resumen')).toContainText('Propinas (aparte)', { timeout: 8_000 })
    await expect(page.getByLabel('Ventas por mesonero')).toContainText('Maria P')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(R5, `reportes-${vp.w}.png`), fullPage: true })
  }
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF' }).click()])
  expect(download.suggestedFilename()).toMatch(/^restaurante-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.pdf$/)
})
