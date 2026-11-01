import { shiftDateKey } from '@/lib/business-day'
import type { GroupMetricRow, MetricsGroupBy, MetricsRange, ProductMetricRow } from '@/types/metrics'

// Cálculo puro de Métricas (sin base de datos): rangos, avance de metas. Reglas en .doc/CONTRATO_METRICAS.md.

export const MAX_RANGE_DAYS = 366
const MS_DAY = 86_400_000

const r1 = (x: number): number => Math.round(x * 10) / 10
const r2 = (x: number): number => Math.round(x * 100) / 100

function keyToUtc(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Días inclusivos entre dos claves 'YYYY-MM-DD' (mismo día = 1). */
export function inclusiveDays(from: string, to: string): number {
  return Math.round((keyToUtc(to) - keyToUtc(from)) / MS_DAY) + 1
}

/** Rango pedido + el período anterior de IGUAL duración, inmediatamente previo. */
export function rangeWithPrevious(from: string, to: string): { range: MetricsRange; prev: MetricsRange } {
  const days = inclusiveDays(from, to)
  return {
    range: { from, to, days },
    prev: { from: shiftDateKey(from, -days), to: shiftDateKey(from, -1), days },
  }
}

/** Mes en curso hasta hoy: rango por defecto cuando no se pasa from/to. */
export function monthToDate(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 7)}-01`, to: today }
}

/** Días que tiene el mes 'YYYY-MM'. */
export function daysInMonth(period: string): number {
  const [y, m] = period.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export interface GoalProgress {
  pct: number
  remaining: number
  days_left: number
  per_day_needed: number | null
}

/** Avance de una meta. `today` = 'YYYY-MM-DD' en hora del negocio. */
export function goalProgress(target: number, actual: number, period: string, today: string): GoalProgress {
  const remaining = r2(Math.max(0, target - actual))
  const pct = target > 0 ? r1((actual / target) * 100) : 0
  const current = today.slice(0, 7)
  if (period < current) return { pct, remaining, days_left: 0, per_day_needed: null } // mes cerrado
  const days_left = period === current ? daysInMonth(period) - Number(today.slice(8, 10)) + 1 : daysInMonth(period)
  return { pct, remaining, days_left, per_day_needed: remaining === 0 ? 0 : r2(remaining / days_left) }
}

/* ───────────────────────── Agrupación ───────────────────────── */

const NO_CATEGORY = 'Sin categoría'
const NO_SUBCATEGORY = 'Sin subcategoría'
const NO_BRAND = 'Sin marca'

export interface GroupInput {
  category_id: number | null
  category: string | null
  brand_id: number | null
  brand: string | null
  subcategory: string | null
  cur: { qty: number; usd: number; bs: number }
  prev: { qty: number; usd: number; bs: number }
}

/** Clave de igualdad de subcategorías: sin tildes ni mayúsculas ni espacios de más. */
function subKey(s: string): string {
  return s.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
const COMBINING_MARKS = /[\u0300-\u036f]/g

/** Agrupa productos por categoría | subcategoría | marca; "Sin …" es fila propia (key_id null). Orden: usd desc, label asc. */
type Acc = Omit<GroupMetricRow, 'qty' | 'prev_qty'> & { qty: number; prev_qty: number }

export function groupRows(by: MetricsGroupBy, items: GroupInput[]): GroupMetricRow[] {
  const groups = new Map<string, Acc>()
  for (const it of items) {
    let id: number | null = null
    let label: string
    let key: string
    if (by === 'category') { id = it.category_id; label = it.category ?? NO_CATEGORY; key = String(id) }
    else if (by === 'brand') { id = it.brand_id; label = it.brand ?? NO_BRAND; key = String(id) }
    else { label = it.subcategory?.trim() || NO_SUBCATEGORY; key = subKey(label) }
    const g = groups.get(key) ?? { key_id: id, label, qty: 0, usd: 0, bs: 0, prev_qty: 0, prev_usd: 0, products_count: 0 }
    g.qty += it.cur.qty; g.usd += it.cur.usd; g.bs += it.cur.bs
    g.prev_qty += it.prev.qty; g.prev_usd += it.prev.usd
    g.products_count += 1
    groups.set(key, g)
  }
  return Array.from(groups.values())
    .map(g => ({ ...g, qty: Math.round(g.qty * 1000) / 1000, usd: r2(g.usd), bs: r2(g.bs), prev_qty: Math.round(g.prev_qty * 1000) / 1000, prev_usd: r2(g.prev_usd) }))
    .sort((a, b) => b.usd - a.usd || a.label.localeCompare(b.label, 'es'))
}

/* ───────────────────── Ventas sin detalle de producto (v1.2) ───────────────────── */

export const NO_DETAIL_LABEL = 'Ventas sin detalle de producto'

export interface Money { usd: number; bs: number }

const r4 = (x: number): number => Math.round(x * 10000) / 10000

/** Lo que reportes cuenta y no se atribuye a un producto: neto del rango − Σ neto por producto (4 decimales). */
export function remainder(net: Money, attributed: Money): Money {
  return { usd: r4(net.usd - attributed.usd), bs: r4(net.bs - attributed.bs) }
}

/** ¿Hay algo que mostrar? (ruido de redondeo menor a medio centavo no crea fila). */
export function hasRemainder(cur: Money, prev: Money): boolean {
  return [cur.usd, cur.bs, prev.usd].some(v => Math.abs(v) >= 0.005)
}

export function noDetailProductRow(cur: Money, prev: Money): ProductMetricRow {
  return {
    product_id: null, name: NO_DETAIL_LABEL, category: null, subcategory: null, brand: null,
    qty: null, usd: r2(cur.usd), bs: r2(cur.bs), prev_qty: null, prev_usd: r2(prev.usd),
  }
}

export function noDetailGroupRow(cur: Money, prev: Money): GroupMetricRow {
  return {
    key_id: null, label: NO_DETAIL_LABEL, qty: null, usd: r2(cur.usd), bs: r2(cur.bs),
    prev_qty: null, prev_usd: r2(prev.usd), products_count: 0,
  }
}
