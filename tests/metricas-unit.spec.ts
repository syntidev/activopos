import { test, expect } from '@playwright/test'
import {
  NO_DETAIL_LABEL, daysInMonth, goalProgress, groupRows, hasRemainder, inclusiveDays, monthToDate, noDetailGroupRow, noDetailProductRow,
  rangeWithPrevious, remainder, type GroupInput,
} from '../src/lib/metrics-calc'
import { createGoalSchema, exportQuerySchema, goalsQuerySchema, groupsQuerySchema, patchGoalSchema, productsQuerySchema } from '../src/lib/metrics-schemas'

/** Unit (sin navegador, sin servidor, sin base): rangos, avance de metas, agrupación y validación de Métricas. */

test.describe('rangos', () => {
  test('inclusiveDays cuenta ambos extremos', () => {
    expect(inclusiveDays('2026-10-01', '2026-10-01')).toBe(1)
    expect(inclusiveDays('2026-10-01', '2026-10-31')).toBe(31)
  })
  test('período anterior de igual duración, inmediatamente previo', () => {
    expect(rangeWithPrevious('2026-10-08', '2026-10-14')).toEqual({
      range: { from: '2026-10-08', to: '2026-10-14', days: 7 },
      prev: { from: '2026-10-01', to: '2026-10-07', days: 7 },
    })
  })
  test('un solo día: el anterior es el día previo', () => {
    expect(rangeWithPrevious('2026-10-01', '2026-10-01').prev).toEqual({ from: '2026-09-30', to: '2026-09-30', days: 1 })
  })
  test('cruza mes y año', () => {
    expect(rangeWithPrevious('2026-01-01', '2026-01-31').prev).toEqual({ from: '2025-12-01', to: '2025-12-31', days: 31 })
    expect(rangeWithPrevious('2026-03-01', '2026-03-31').prev).toEqual({ from: '2026-01-29', to: '2026-02-28', days: 31 })
  })
  test('rango por defecto: mes en curso hasta hoy', () => {
    expect(monthToDate('2026-10-17')).toEqual({ from: '2026-10-01', to: '2026-10-17' })
  })
})

test.describe('avance de metas', () => {
  test('a mitad de mes: días restantes incluyen hoy', () => {
    expect(goalProgress(100, 40, '2026-10', '2026-10-16')).toEqual({ pct: 40, remaining: 60, days_left: 16, per_day_needed: 3.75 })
  })
  test('hoy es el último día del mes: queda 1 día', () => {
    expect(goalProgress(100, 40, '2026-10', '2026-10-31')).toEqual({ pct: 40, remaining: 60, days_left: 1, per_day_needed: 60 })
  })
  test('primer día del mes: todo el mes por delante', () => {
    expect(goalProgress(310, 0, '2026-10', '2026-10-01')).toEqual({ pct: 0, remaining: 310, days_left: 31, per_day_needed: 10 })
  })
  test('mes cerrado: sin días y sin ritmo', () => {
    expect(goalProgress(100, 80, '2026-09', '2026-10-05')).toEqual({ pct: 80, remaining: 20, days_left: 0, per_day_needed: null })
  })
  test('mes futuro: todo el mes por delante', () => {
    expect(goalProgress(300, 0, '2026-11', '2026-10-31')).toEqual({ pct: 0, remaining: 300, days_left: 30, per_day_needed: 10 })
  })
  test('meta superada: pct mayor a 100, nada por vender', () => {
    expect(goalProgress(100, 120, '2026-10', '2026-10-16')).toEqual({ pct: 120, remaining: 0, days_left: 16, per_day_needed: 0 })
  })
  test('febrero bisiesto', () => {
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2026-02')).toBe(28)
  })
})

const item = (over: Partial<GroupInput>): GroupInput => ({
  category_id: null, category: null, brand_id: null, brand: null, subcategory: null,
  cur: { qty: 1, usd: 10, bs: 1000 }, prev: { qty: 0, usd: 0, bs: 0 }, ...over,
})

test.describe('agrupación', () => {
  test('"Sin categoría" y "Sin marca" son fila propia con key_id null', () => {
    const items = [item({ category_id: 3, category: 'Bebidas', brand_id: 7, brand: 'Garmin' }), item({ cur: { qty: 2, usd: 5, bs: 500 } })]
    const cat = groupRows('category', items)
    expect(cat.map(r => [r.key_id, r.label, r.usd, r.products_count])).toEqual([[3, 'Bebidas', 10, 1], [null, 'Sin categoría', 5, 1]])
    const brand = groupRows('brand', items)
    expect(brand.find(r => r.key_id === null)).toMatchObject({ label: 'Sin marca', qty: 2, usd: 5, bs: 500 })
  })
  test('subcategoría: junta por texto sin tildes ni mayúsculas; key_id siempre null', () => {
    const rows = groupRows('subcategory', [
      item({ subcategory: 'Camión' }), item({ subcategory: 'camion ' }), item({ subcategory: null }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows.every(r => r.key_id === null)).toBe(true)
    expect(rows.find(r => r.label === 'Camión')).toMatchObject({ products_count: 2, usd: 20 })
    expect(rows.find(r => r.label === 'Sin subcategoría')).toBeDefined()
  })
  test('suma el período anterior y ordena por monto', () => {
    const rows = groupRows('category', [
      item({ category_id: 1, category: 'A', cur: { qty: 1, usd: 5, bs: 0 }, prev: { qty: 4, usd: 40, bs: 0 } }),
      item({ category_id: 2, category: 'B', cur: { qty: 1, usd: 50, bs: 0 } }),
    ])
    expect(rows.map(r => r.label)).toEqual(['B', 'A'])
    expect(rows[1]).toMatchObject({ prev_qty: 4, prev_usd: 40 })
  })
})

test.describe('validación zod', () => {
  test('meta válida; claves desconocidas (.strict) y valores inválidos se rechazan', () => {
    const ok = { scope: 'product', ref_id: 5, period: '2026-10', metric: 'units', target: 150 }
    expect(createGoalSchema.safeParse(ok).success).toBe(true)
    expect(createGoalSchema.safeParse({ ...ok, business_id: 99 }).success).toBe(false) // nunca del body
    expect(createGoalSchema.safeParse({ ...ok, target: 0 }).success).toBe(false)
    expect(createGoalSchema.safeParse({ ...ok, target: -5 }).success).toBe(false)
    expect(createGoalSchema.safeParse({ ...ok, period: '2026-13' }).success).toBe(false)
    expect(createGoalSchema.safeParse({ ...ok, period: '2026-1' }).success).toBe(false)
    expect(createGoalSchema.safeParse({ ...ok, scope: 'user' }).success).toBe(false)
    expect(createGoalSchema.safeParse({ ...ok, metric: 'bs' }).success).toBe(false)
    expect(createGoalSchema.safeParse({ ...ok, ref_id: 1.5 }).success).toBe(false)
  })
  test('PATCH solo acepta target mayor a 0', () => {
    expect(patchGoalSchema.safeParse({ target: 10 }).success).toBe(true)
    expect(patchGoalSchema.safeParse({ target: 0 }).success).toBe(false)
    expect(patchGoalSchema.safeParse({ target: 10, metric: 'usd' }).success).toBe(false)
    expect(patchGoalSchema.safeParse({}).success).toBe(false)
  })
  test('rango: from y to juntos, from <= to, máximo 366 días', () => {
    expect(productsQuerySchema.safeParse({}).success).toBe(true)
    expect(productsQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-31' }).success).toBe(true)
    expect(productsQuerySchema.safeParse({ from: '2026-10-01' }).success).toBe(false)
    expect(productsQuerySchema.safeParse({ from: '2026-10-31', to: '2026-10-01' }).success).toBe(false)
    expect(productsQuerySchema.safeParse({ from: '2025-01-01', to: '2025-12-31' }).success).toBe(true) // 365 días
    expect(productsQuerySchema.safeParse({ from: '2025-01-01', to: '2026-01-02' }).success).toBe(false)
    expect(productsQuerySchema.safeParse({ from: '2026/10/01', to: '2026-10-02' }).success).toBe(false)
    expect(productsQuerySchema.safeParse({ from: '2026-02-31', to: '2026-03-02' }).success).toBe(false) // fecha inexistente
    expect(productsQuerySchema.safeParse({ from: '2028-02-29', to: '2028-03-01' }).success).toBe(true) // bisiesto real
  })
  test('filtros: ids positivos, vacío = ausente, q acotada', () => {
    expect(productsQuerySchema.safeParse({ category_id: '' }).success).toBe(true)
    expect(productsQuerySchema.safeParse({ category_id: '3', brand_id: '4', cashier_id: '5' }).success).toBe(true)
    expect(productsQuerySchema.safeParse({ category_id: '0' }).success).toBe(false)
    expect(productsQuerySchema.safeParse({ brand_id: 'abc' }).success).toBe(false)
    expect(productsQuerySchema.safeParse({ q: 'x'.repeat(61) }).success).toBe(false)
    expect(productsQuerySchema.safeParse({ q: 'a b c d e f' }).success).toBe(false)
    expect(productsQuerySchema.safeParse({ q: 'a b c d e' }).success).toBe(true)
  })
  test('groups exige by; export exige view (y by si view=groups); metas: period opcional válido', () => {
    expect(groupsQuerySchema.safeParse({}).success).toBe(false)
    expect(groupsQuerySchema.safeParse({ by: 'brand' }).success).toBe(true)
    expect(groupsQuerySchema.safeParse({ by: 'color' }).success).toBe(false)
    expect(exportQuerySchema.safeParse({ view: 'products' }).success).toBe(true)
    expect(exportQuerySchema.safeParse({ view: 'groups' }).success).toBe(false)
    expect(exportQuerySchema.safeParse({ view: 'groups', by: 'category' }).success).toBe(true)
    expect(goalsQuerySchema.safeParse({}).success).toBe(true)
    expect(goalsQuerySchema.safeParse({ period: '2026-10' }).success).toBe(true)
    expect(goalsQuerySchema.safeParse({ period: '2026-00' }).success).toBe(false)
  })
})

test.describe('ventas sin detalle de producto (v1.2)', () => {
  test('una venta sin líneas: reportes cuenta $25 que ningún producto explica y queda como resto', () => {
    // reportes (netSales): 185.00 / Bs 18,500; Σ por producto: 160.00 / Bs 16,000; la venta sin líneas pesa 25.00 / Bs 2,500
    expect(remainder({ usd: 185, bs: 18500 }, { usd: 160, bs: 16000 })).toEqual({ usd: 25, bs: 2500 })
  })
  test('sin ventas sin líneas el resto es 0 y no crea fila; el ruido de redondeo tampoco', () => {
    const cero = remainder({ usd: 160, bs: 16000 }, { usd: 160, bs: 16000 })
    expect(cero).toEqual({ usd: 0, bs: 0 })
    expect(hasRemainder(cero, { usd: 0, bs: 0 })).toBe(false)
    expect(hasRemainder({ usd: 0.0004, bs: 0.0002 }, { usd: 0, bs: 0 })).toBe(false)
    expect(hasRemainder({ usd: 25, bs: 2500 }, { usd: 0, bs: 0 })).toBe(true)
    expect(hasRemainder({ usd: 0, bs: 0 }, { usd: 40, bs: 0 })).toBe(true) // solo el período anterior tuvo resto
  })
  test('fila de producto: product_id y qty null, usd/bs reales, sin categoría ni marca', () => {
    expect(noDetailProductRow({ usd: 25, bs: 2500 }, { usd: 10, bs: 0 })).toEqual({
      product_id: null, name: NO_DETAIL_LABEL, category: null, subcategory: null, brand: null,
      qty: null, usd: 25, bs: 2500, prev_qty: null, prev_usd: 10,
    })
  })
  test('fila de grupo: key_id y qty null, products_count 0', () => {
    expect(noDetailGroupRow({ usd: 25, bs: 2500 }, { usd: 0, bs: 0 })).toEqual({
      key_id: null, label: 'Ventas sin detalle de producto', qty: null, usd: 25, bs: 2500, prev_qty: null, prev_usd: 0, products_count: 0,
    })
  })
  test('el total con el resto iguala al neto de reportes', () => {
    const rows = [{ usd: 132, bs: 13200 }, { usd: 28, bs: 2800 }]
    const resto = remainder({ usd: 185, bs: 18500 }, { usd: 160, bs: 16000 })
    const usd = rows.reduce((a, r) => a + r.usd, resto.usd)
    const bs = rows.reduce((a, r) => a + r.bs, resto.bs)
    expect([usd, bs]).toEqual([185, 18500])
  })
})
