import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import * as XLSX from 'xlsx'
import { envValue, sql } from './alta-helpers'

/**
 * Métricas (ventas por producto/grupo y metas) contra el servidor y la base local. Negocio 80; datos ZZM-* con fechas de 2001
 * (no chocan con ventas reales) y se borran al final. Incluye ventas con DESCUENTO GLOBAL y CARGO GLOBAL (sales.total_* distinto de
 * Σ ítems), una devolución parcial, una venta cancelada y una devuelta (excluidas), y verifica que la suma de /api/metrics/products
 * cuadra al centavo con el total de /api/reports/range.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 80
const OTHER_BUSINESS_ID = 87
const ADMIN_ID = 79
const FROM = '2001-03-01'
const TO = '2001-03-31'
const Q = `from=${FROM}&to=${TO}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let p1 = 0 // ZZ Metricas Reloj (con marca)
let p2 = 0 // ZZ Metricas Taza (sin marca)
let brandId = 0
let foreignProductId = 0

async function token(role: 'admin' | 'cashier', businessId = BUSINESS_ID): Promise<string> {
  return new SignJWT({ userId: ADMIN_ID, businessId, role, name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
}

async function as(role: 'admin' | 'cashier' | null, businessId = BUSINESS_ID): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: BASE,
    ...(role ? { extraHTTPHeaders: { cookie: `activopos_session=${await token(role, businessId)}` } } : {}),
  })
}

function cleanup(): void {
  sql(`DELETE ri FROM return_items ri JOIN returns r ON r.id = ri.return_id JOIN sales s ON s.id = r.sale_id WHERE s.business_id=${BUSINESS_ID} AND s.ticket_number LIKE 'ZZM-%'`)
  sql(`DELETE r FROM returns r JOIN sales s ON s.id = r.sale_id WHERE s.business_id=${BUSINESS_ID} AND s.ticket_number LIKE 'ZZM-%'`)
  sql(`DELETE si FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.business_id=${BUSINESS_ID} AND s.ticket_number LIKE 'ZZM-%'`)
  sql(`DELETE FROM sales WHERE business_id=${BUSINESS_ID} AND ticket_number LIKE 'ZZM-%'`)
  sql(`DELETE FROM sales_goals WHERE business_id IN (${BUSINESS_ID}, ${OTHER_BUSINESS_ID}) AND period LIKE '2001-%'`)
  const ids = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Metricas%'`).split('\n').filter(Boolean).join(',')
  if (ids) {
    sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
    sql(`DELETE FROM product_variants WHERE product_id IN (${ids})`)
    sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
    sql(`DELETE FROM products WHERE business_id=${BUSINESS_ID} AND id IN (${ids})`)
  }
  sql(`DELETE FROM brands WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Metricas%'`)
}

/** Inserta una venta con sus líneas [product_id, qty, subtotal_usd, subtotal_bs]. Devuelve los ids de línea. */
function venta(ticket: string, status: string, totalUsd: number, totalBs: number, soldAtUtc: string, items: [number, number, number, number][]): { saleId: number; itemIds: number[] } {
  sql(`INSERT INTO sales (business_id, cashier_id, ticket_number, status, total_usd, total_bs, rate_used, sold_at, updated_at)
       VALUES (${BUSINESS_ID}, ${ADMIN_ID}, '${ticket}', '${status}', ${totalUsd}, ${totalBs}, 100, '${soldAtUtc}', NOW(3))`)
  const saleId = Number(sql(`SELECT id FROM sales WHERE business_id=${BUSINESS_ID} AND ticket_number='${ticket}'`))
  const itemIds = items.map(([pid, qty, usd, bs]) => {
    sql(`INSERT INTO sale_items (sale_id, product_id, product_name, sale_mode, unit_label, quantity, price_per_unit_usd, subtotal_usd, subtotal_bs, rate_used)
         VALUES (${saleId}, ${pid}, 'ZZ Metricas', 'unit', 'und', ${qty}, ${usd / qty}, ${usd}, ${bs}, 100)`)
    return Number(sql(`SELECT MAX(id) FROM sale_items WHERE sale_id=${saleId}`))
  })
  return { saleId, itemIds }
}

test.beforeAll(async () => {
  cleanup()
  api = await as('admin')
  const b = await api.post('/api/brands', { data: { name: 'ZZ Metricas Marca', search_term: 'zz metricas' } })
  expect(b.status(), await b.text()).toBeLessThan(300)
  brandId = Number(sql(`SELECT id FROM brands WHERE business_id=${BUSINESS_ID} AND name='ZZ Metricas Marca'`))
  const mk = async (name: string, brand?: number): Promise<number> => {
    const r = await api.post('/api/products', {
      data: { name, cost_per_unit_usd: 5, price_per_unit_usd: 10, stock_quantity: 20, ...(brand ? { brand_id: brand } : {}) },
    })
    expect(r.status(), await r.text()).toBe(201)
    return ((await r.json()) as { product: { id: number } }).product.id
  }
  p1 = await mk('ZZ Metricas Reloj', brandId)
  p2 = await mk('ZZ Metricas Taza')
  foreignProductId = Number(sql(`SELECT id FROM products WHERE business_id=${OTHER_BUSINESS_ID} LIMIT 1`))

  // A: DESCUENTO GLOBAL 10% (ítems 50 → total 45): P1 20→18, P2 30→27
  venta('ZZM-A', 'paid', 45, 4500, '2001-03-10 16:00:00', [[p1, 2, 20, 2000], [p2, 1, 30, 3000]])
  // B: partial_return con devolución aprobada de 1 unidad de P1 ($10 / Bs 1000): P1 neto qty 1, $10
  const b1 = venta('ZZM-B', 'partial_return', 20, 2000, '2001-03-12 16:00:00', [[p1, 2, 20, 2000]])
  sql(`INSERT INTO returns (business_id, sale_id, reason, status, total_usd, total_bs, rate_used, created_by, updated_at)
       VALUES (${BUSINESS_ID}, ${b1.saleId}, 'ZZM prueba', 'approved', 10, 1000, 100, ${ADMIN_ID}, NOW(3))`)
  const retId = Number(sql(`SELECT MAX(id) FROM returns WHERE sale_id=${b1.saleId}`))
  sql(`INSERT INTO return_items (return_id, product_id, qty, price_usd, total_usd, sale_item_id) VALUES (${retId}, ${p1}, 1, 10, 10, ${b1.itemIds[0]})`)
  // C: CARGO GLOBAL 5% (ítem 100 → total 105)
  venta('ZZM-C', 'paid', 105, 10500, '2001-03-20 16:00:00', [[p2, 1, 100, 10000]])
  // D cancelada y E devuelta: no cuentan
  venta('ZZM-D', 'cancelled', 90, 9000, '2001-03-11 16:00:00', [[p1, 9, 90, 9000]])
  venta('ZZM-E', 'returned', 10, 1000, '2001-03-13 16:00:00', [[p1, 1, 10, 1000]])
  // F: período anterior (misma duración: 2001-01-29 a 2001-02-28)
  venta('ZZM-F', 'paid', 40, 4000, '2001-02-15 16:00:00', [[p1, 4, 40, 4000]])
})

test.afterAll(async () => {
  cleanup()
  await api.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM sales WHERE business_id=${BUSINESS_ID} AND ticket_number LIKE 'ZZM-%'`))).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Metricas%'`))).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM sales_goals WHERE period LIKE '2001-%'`))).toBe(0)
})

interface ProductRow { product_id: number; name: string; brand: string | null; qty: number; usd: number; bs: number; prev_qty: number; prev_usd: number }
interface Totals { qty: number; usd: number; bs: number; prev_qty: number; prev_usd: number }

test('productos: venta con descuento global y cargo global prorrateados; devuelta/cancelada fuera; comparativo', async () => {
  const r = await api.get(`/api/metrics/products?${Q}`)
  expect(r.status(), await r.text()).toBe(200)
  const body = (await r.json()) as { range: { days: number }; prev_range: { from: string; to: string; days: number }; rows: ProductRow[]; totals: Totals }
  expect(body.range.days).toBe(31)
  expect(body.prev_range).toEqual({ from: '2001-01-29', to: '2001-02-28', days: 31 })
  const reloj = body.rows.find(x => x.product_id === p1)!
  const taza = body.rows.find(x => x.product_id === p2)!
  // P1: A (20 → 18) + B neto (20 − 10 = 10)   P2: A (30 → 27) + C (100 → 105)
  expect(reloj).toMatchObject({ qty: 3, usd: 28, bs: 2800, prev_qty: 4, prev_usd: 40, brand: 'ZZ Metricas Marca' })
  expect(taza).toMatchObject({ qty: 2, usd: 132, bs: 13200, prev_qty: 0, prev_usd: 0, brand: null })
  expect(body.rows.map(x => x.product_id)).toEqual([p2, p1]) // orden por monto desc
  expect(body.totals).toEqual({ qty: 5, usd: 160, bs: 16000, prev_qty: 4, prev_usd: 40 })
})

test('cuadre: la suma de /api/metrics/products == total de /api/reports/range (USD y Bs, al centavo)', async () => {
  const [m, rep] = await Promise.all([api.get(`/api/metrics/products?${Q}`), api.get(`/api/reports/range?${Q}`)])
  expect(rep.status(), await rep.text()).toBe(200)
  const totals = ((await m.json()) as { totals: Totals }).totals
  const report = (await rep.json()) as { total_usd: number; total_bs: number }
  console.log(`CUADRE metrics.totals usd=${totals.usd} bs=${totals.bs} | reports/range total_usd=${report.total_usd} total_bs=${report.total_bs}`)
  expect(totals.usd).toBe(report.total_usd)
  expect(totals.bs).toBe(report.total_bs)
  expect(totals.usd).toBe(160)
})

test('grupos: por marca ("Sin marca" fila propia), por categoría y subcategoría; totales iguales', async () => {
  const brand = (await (await api.get(`/api/metrics/groups?by=brand&${Q}`)).json()) as { rows: { key_id: number | null; label: string; usd: number; products_count: number }[]; totals: Totals }
  expect(brand.rows.map(x => [x.key_id, x.label, x.usd, x.products_count])).toEqual([[null, 'Sin marca', 132, 1], [brandId, 'ZZ Metricas Marca', 28, 1]])
  expect(brand.totals.usd).toBe(160)
  const cat = (await (await api.get(`/api/metrics/groups?by=category&${Q}`)).json()) as { rows: { key_id: number | null; label: string; usd: number }[]; totals: Totals }
  expect(cat.rows).toEqual([expect.objectContaining({ key_id: null, label: 'Sin categoría', usd: 160 })])
  const sub = (await (await api.get(`/api/metrics/groups?by=subcategory&${Q}`)).json()) as { rows: { key_id: number | null; label: string }[] }
  expect(sub.rows).toEqual([expect.objectContaining({ key_id: null, label: 'Sin subcategoría' })])
})

test('filtros: marca, búsqueda sin tildes, cajero inexistente; parámetros inválidos dan 400', async () => {
  const byBrand = (await (await api.get(`/api/metrics/products?${Q}&brand_id=${brandId}`)).json()) as { rows: ProductRow[]; totals: Totals }
  expect(byBrand.rows.map(x => x.product_id)).toEqual([p1])
  expect(byBrand.totals.usd).toBe(28)
  const byQ = (await (await api.get(`/api/metrics/products?${Q}&q=TAZA%20zz`)).json()) as { rows: ProductRow[] }
  expect(byQ.rows.map(x => x.product_id)).toEqual([p2])
  const noCashier = (await (await api.get(`/api/metrics/products?${Q}&cashier_id=999999`)).json()) as { rows: ProductRow[]; totals: Totals }
  expect(noCashier.rows).toEqual([])
  expect(noCashier.totals.usd).toBe(0)
  const mine = (await (await api.get(`/api/metrics/products?${Q}&cashier_id=${ADMIN_ID}`)).json()) as { totals: Totals }
  expect(mine.totals.usd).toBe(160)
  for (const bad of [`from=${FROM}`, `from=${TO}&to=${FROM}`, 'from=2000-01-01&to=2002-01-02', 'category_id=0']) {
    expect((await api.get(`/api/metrics/products?${bad}`)).status(), bad).toBe(400)
  }
  expect((await api.get(`/api/metrics/groups?${Q}`)).status()).toBe(400) // falta by
  const cashiers = (await (await api.get('/api/metrics/cashiers')).json()) as { id: number; name: string }[]
  expect(cashiers.some(c => c.id === ADMIN_ID)).toBe(true)
})

test('acceso: sin sesión y cajero quedan fuera (middleware 307; el handler respondería 401/403)', async () => {
  const anon = await as(null)
  const cashier = await as('cashier')
  for (const url of ['/api/metrics/products', '/api/metrics/cashiers', '/api/metrics/goals', '/api/metrics/groups?by=brand']) {
    // Sin sesión el middleware global redirige a /login (307), igual que /api/reports; no entra al handler.
    expect([307, 401], `anon ${url}`).toContain((await anon.get(url, { maxRedirects: 0 })).status())
    expect([307, 403], `cajero ${url}`).toContain((await cashier.get(url, { maxRedirects: 0 })).status())
  }
  const post = await cashier.post('/api/metrics/goals', { maxRedirects: 0, data: { scope: 'product', ref_id: p1, period: '2001-03', metric: 'units', target: 1 } })
  expect([307, 403]).toContain(post.status())
  expect(Number(sql(`SELECT COUNT(*) FROM sales_goals WHERE business_id=${BUSINESS_ID} AND period='2001-03'`))).toBe(0)
  await anon.dispose()
  await cashier.dispose()
})

interface Goal { id: number; label: string; metric: string; target: number; actual: number; pct: number; remaining: number; days_left: number; per_day_needed: number | null }

test('metas: crear (unidades y USD), duplicado 409, ref ajeno 404, strict 400, editar, listar y borrar', async () => {
  const mkGoal = (data: object) => api.post('/api/metrics/goals', { data })
  const c1 = await mkGoal({ scope: 'product', ref_id: p1, period: '2001-03', metric: 'units', target: 10 })
  expect(c1.status(), await c1.text()).toBe(201)
  const g1 = ((await c1.json()) as { goal: Goal }).goal
  // mes cerrado (2001): sin días ni ritmo; P1 vendió 3 unidades netas
  expect(g1).toMatchObject({ label: 'ZZ Metricas Reloj', target: 10, actual: 3, pct: 30, remaining: 7, days_left: 0, per_day_needed: null })

  const c2 = await mkGoal({ scope: 'brand', ref_id: brandId, period: '2001-03', metric: 'usd', target: 56 })
  expect(c2.status(), await c2.text()).toBe(201)
  expect(((await c2.json()) as { goal: Goal }).goal).toMatchObject({ label: 'ZZ Metricas Marca', actual: 28, pct: 50, remaining: 28 })

  expect((await mkGoal({ scope: 'product', ref_id: p1, period: '2001-03', metric: 'units', target: 99 })).status()).toBe(409)
  expect((await mkGoal({ scope: 'product', ref_id: foreignProductId, period: '2001-03', metric: 'units', target: 5 })).status()).toBe(404)
  expect((await mkGoal({ scope: 'category', ref_id: 99999999, period: '2001-03', metric: 'units', target: 5 })).status()).toBe(404)
  expect((await mkGoal({ scope: 'product', ref_id: p1, period: '2001-03', metric: 'units', target: 5, business_id: OTHER_BUSINESS_ID })).status()).toBe(400)
  expect((await mkGoal({ scope: 'product', ref_id: p1, period: '2001-03', metric: 'units', target: 0 })).status()).toBe(400)

  const upd = await api.patch(`/api/metrics/goals/${g1.id}`, { data: { target: 20 } })
  expect(upd.status(), await upd.text()).toBe(200)
  expect(((await upd.json()) as { goal: Goal }).goal).toMatchObject({ target: 20, pct: 15, remaining: 17 })
  expect((await api.patch(`/api/metrics/goals/${g1.id}`, { data: { target: 5, metric: 'usd' } })).status()).toBe(400)

  const list = (await (await api.get('/api/metrics/goals?period=2001-03')).json()) as Goal[]
  expect(list.map(g => g.label)).toEqual(['ZZ Metricas Marca', 'ZZ Metricas Reloj'])
  expect((await (await api.get('/api/metrics/goals?period=2001-04')).json()) as Goal[]).toEqual([])

  // otro negocio: la meta es "no encontrada", nunca visible ni editable
  const other = await as('admin', OTHER_BUSINESS_ID)
  expect((await other.patch(`/api/metrics/goals/${g1.id}`, { data: { target: 1 } })).status()).toBe(404)
  expect((await other.delete(`/api/metrics/goals/${g1.id}`)).status()).toBe(404)
  expect(((await (await other.get('/api/metrics/goals?period=2001-03')).json()) as Goal[]).length).toBe(0)
  expect((await other.post('/api/metrics/goals', { data: { scope: 'product', ref_id: p1, period: '2001-03', metric: 'usd', target: 5 } })).status()).toBe(404)
  await other.dispose()

  expect((await api.delete(`/api/metrics/goals/${g1.id}`)).status()).toBe(200)
  expect((await api.delete(`/api/metrics/goals/${g1.id}`)).status()).toBe(404)
  expect((await api.patch('/api/metrics/goals/abc', { data: { target: 1 } })).status()).toBe(404)
})

test('metas del mes en curso: días restantes (incluye hoy) y ritmo necesario', async () => {
  const hoy = new Date(Date.now() - 4 * 3_600_000) // hora Caracas (UTC-4 fijo)
  const period = hoy.toISOString().slice(0, 7)
  const last = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0)).getUTCDate()
  const daysLeft = last - hoy.getUTCDate() + 1
  const c = await api.post('/api/metrics/goals', { data: { scope: 'product', ref_id: p2, period, metric: 'units', target: 1000 } })
  expect(c.status(), await c.text()).toBe(201)
  const g = ((await c.json()) as { goal: Goal }).goal
  sql(`DELETE FROM sales_goals WHERE id=${g.id}`)
  expect(g.days_left).toBe(daysLeft)
  expect(g.per_day_needed).toBe(Math.round(((1000 - g.actual) / daysLeft) * 100) / 100)
})

test('exportación: .xlsx con USD y Bs (o 403 PLAN_LIMIT si el plan no exporta)', async () => {
  const r = await api.get(`/api/metrics/export?view=products&${Q}`)
  if (r.status() === 403) {
    expect(((await r.json()) as { code: string }).code).toBe('PLAN_LIMIT')
    return
  }
  expect(r.status(), await r.text()).toBe(200)
  expect(r.headers()['content-type']).toContain('spreadsheetml')
  expect(r.headers()['content-disposition']).toContain(`metricas-products-${FROM}_a_${TO}.xlsx`)
  const wb = XLSX.read(await r.body(), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets[wb.SheetNames[0]])
  expect(rows).toHaveLength(2)
  expect(rows.map(x => x['Monto USD'])).toEqual([132, 28])
  expect(rows.map(x => x['Monto Bs'])).toEqual([13200, 2800])
  expect((await api.get(`/api/metrics/export?view=groups&${Q}`)).status()).toBe(400) // falta by
})
