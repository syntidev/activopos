import { prisma } from '@/lib/prisma'
import { businessDateKey, businessMonthRange, businessRange } from '@/lib/business-day'
import { netProductLines, netSales, type NetProductLine } from '@/lib/sales-returns'
import { normalizeSearchTerm } from '@/lib/pulso-events'
import {
  goalProgress, groupRows, hasRemainder, monthToDate, noDetailGroupRow, noDetailProductRow, rangeWithPrevious, remainder, type Money,
} from '@/lib/metrics-calc'
import type {
  GoalMetric, GoalScope, GroupsMetricsResponse, MetricsCashier, MetricsGroupBy, MetricsRange,
  MetricsTotals, ProductMetricRow, ProductsMetricsResponse, SalesGoalItem,
} from '@/types/metrics'

// Capa de datos de Métricas. Ventas netas: `netProductLines` (sales-returns.ts, fuente única). Contrato: .doc/CONTRATO_METRICAS.md.

export interface MetricsFilters {
  from?: string
  to?: string
  category_id?: number
  brand_id?: number
  cashier_id?: number
  q?: string
}

const r2 = (x: number): number => Math.round(x * 100) / 100
const r3 = (x: number): number => Math.round(x * 1000) / 1000

interface ProductMeta {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  category_id: number | null
  brand_id: number | null
  subcategory: string | null
  category: { name: string } | null
  brand: { name: string } | null
}

interface Merged {
  meta: ProductMeta
  cur: NetProductLine
  prev: NetProductLine
}

const ZERO: NetProductLine = { qty: 0, usd: 0, bs: 0 }

async function netFor(businessId: number, r: MetricsRange, cashierId?: number): Promise<Map<number, NetProductLine>> {
  const { start, end } = businessRange(r.from, r.to)
  return netProductLines(businessId, start, end, cashierId)
}

/** Una consulta de ventas netas por período + una de metadatos: sin N+1. Solo productos con actividad en alguno de los dos. */
interface NoDetail { cur: Money; prev: Money }

/** v1.2: neto del rango (netSales, la misma cifra de /api/reports) − Σ neto atribuido a productos. Cubre ventas sin líneas,
 *  productos borrados y devoluciones sin línea: así `totals` == reportes al centavo. */
async function noDetailFor(businessId: number, r: MetricsRange, attributed: Map<number, NetProductLine>, cashierId?: number): Promise<Money> {
  const { start, end } = businessRange(r.from, r.to)
  const net = await netSales(businessId, start, end, cashierId)
  const sum = Array.from(attributed.values()).reduce((a, n) => ({ usd: a.usd + n.usd, bs: a.bs + n.bs }), { usd: 0, bs: 0 })
  return remainder(net.net, sum)
}

async function loadMerged(businessId: number, f: MetricsFilters): Promise<{ range: MetricsRange; prev: MetricsRange; merged: Merged[]; noDetail: NoDetail | null }> {
  const { from, to } = f.from && f.to ? { from: f.from, to: f.to } : monthToDate(businessDateKey())
  const { range, prev } = rangeWithPrevious(from, to)
  const [cur, before] = await Promise.all([netFor(businessId, range, f.cashier_id), netFor(businessId, prev, f.cashier_id)])
  const ids = Array.from(new Set([...Array.from(cur.keys()), ...Array.from(before.keys())]))
  // Con filtro de categoría/marca/búsqueda lo "sin detalle" no se puede atribuir: no aplica.
  const productFiltered = Boolean(f.category_id || f.brand_id || f.q)
  const noDetail: NoDetail | null = productFiltered ? null : {
    cur: await noDetailFor(businessId, range, cur, f.cashier_id),
    prev: await noDetailFor(businessId, prev, before, f.cashier_id),
  }

  const metas: ProductMeta[] = ids.length === 0 ? [] : await prisma.product.findMany({
    where: { business_id: businessId, id: { in: ids } },
    select: {
      id: true, name: true, sku: true, barcode: true, category_id: true, brand_id: true, subcategory: true,
      category: { select: { name: true } },
      brand: { select: { name: true } },
    },
  })
  const words = f.q ? normalizeSearchTerm(f.q).split(' ').filter(Boolean) : []

  const merged: Merged[] = []
  for (const meta of metas) {
    if (f.category_id && meta.category_id !== f.category_id) continue
    if (f.brand_id && meta.brand_id !== f.brand_id) continue
    if (words.length > 0) {
      const hay = normalizeSearchTerm([meta.name, meta.sku, meta.barcode, meta.category?.name, meta.brand?.name].filter(Boolean).join(' '))
      if (!words.every(w => hay.includes(w))) continue
    }
    const c = cur.get(meta.id) ?? ZERO
    const p = before.get(meta.id) ?? ZERO
    if (c.qty === 0 && c.usd === 0 && p.qty === 0 && p.usd === 0) continue
    merged.push({ meta, cur: c, prev: p })
  }
  return { range, prev, merged, noDetail }
}

/** Totales desde los montos por producto con 4 decimales (sin redondear a centavos): así cuadran con netSales (reportes). */
function totalsOf(merged: Merged[], noDetail: NoDetail | null): MetricsTotals {
  const extra = noDetail ?? { cur: { usd: 0, bs: 0 }, prev: { usd: 0, bs: 0 } }
  const t = merged.reduce((a, { cur, prev }) => ({
    qty: a.qty + cur.qty, usd: a.usd + cur.usd, bs: a.bs + cur.bs, prev_qty: a.prev_qty + prev.qty, prev_usd: a.prev_usd + prev.usd,
  }), { qty: 0, usd: extra.cur.usd, bs: extra.cur.bs, prev_qty: 0, prev_usd: extra.prev.usd })
  return { qty: r3(t.qty), usd: r2(t.usd), bs: r2(t.bs), prev_qty: r3(t.prev_qty), prev_usd: r2(t.prev_usd) }
}

export async function getProductMetrics(businessId: number, f: MetricsFilters): Promise<ProductsMetricsResponse> {
  const { range, prev, merged, noDetail } = await loadMerged(businessId, f)
  const rows: ProductMetricRow[] = merged.map(({ meta, cur, prev: p }) => ({
    product_id: meta.id,
    name: meta.name,
    category: meta.category?.name ?? null,
    subcategory: meta.subcategory?.trim() || null,
    brand: meta.brand?.name ?? null,
    qty: r3(cur.qty), usd: r2(cur.usd), bs: r2(cur.bs),
    prev_qty: r3(p.qty), prev_usd: r2(p.usd),
  }))
  rows.sort((a, b) => b.usd - a.usd || a.name.localeCompare(b.name, 'es'))
  if (noDetail && hasRemainder(noDetail.cur, noDetail.prev)) rows.push(noDetailProductRow(noDetail.cur, noDetail.prev)) // siempre última
  return { range, prev_range: prev, rows, totals: totalsOf(merged, noDetail) }
}

export async function getGroupMetrics(
  businessId: number,
  by: MetricsGroupBy,
  f: Pick<MetricsFilters, 'from' | 'to' | 'cashier_id'>,
): Promise<GroupsMetricsResponse> {
  const { range, prev, merged, noDetail } = await loadMerged(businessId, f)
  const rows = groupRows(by, merged.map(({ meta, cur, prev: p }) => ({
    category_id: meta.category_id, category: meta.category?.name ?? null,
    brand_id: meta.brand_id, brand: meta.brand?.name ?? null,
    subcategory: meta.subcategory, cur, prev: p,
  })))
  if (noDetail && hasRemainder(noDetail.cur, noDetail.prev)) rows.push(noDetailGroupRow(noDetail.cur, noDetail.prev)) // siempre última
  return { by, range, prev_range: prev, rows, totals: totalsOf(merged, noDetail) }
}

export async function getCashiers(businessId: number): Promise<MetricsCashier[]> {
  return prisma.user.findMany({
    where: { business_id: businessId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

/* ───────────────────────── Metas ───────────────────────── */

/** ¿El producto/categoría/marca `ref_id` pertenece a este negocio? */
export async function refExists(businessId: number, scope: GoalScope, refId: number): Promise<boolean> {
  const where = { id: refId, business_id: businessId }
  if (scope === 'product') return (await prisma.product.count({ where })) > 0
  if (scope === 'category') return (await prisma.category.count({ where })) > 0
  return (await prisma.brand.count({ where })) > 0
}

interface GoalRow {
  id: number
  scope: GoalScope
  ref_id: number
  period: string
  metric: GoalMetric
  target: { toString(): string }
}

/** Arma los `SalesGoalItem` de un período: una consulta de ventas netas del mes + etiquetas por ámbito. */
export async function buildGoalItems(businessId: number, period: string, goals: GoalRow[]): Promise<SalesGoalItem[]> {
  if (goals.length === 0) return []
  const { start, end } = businessMonthRange(period)
  const net = await netProductLines(businessId, start, end)

  const refs = (scope: GoalScope): number[] => goals.filter(g => g.scope === scope).map(g => g.ref_id)
  const catIds = refs('category')
  const brandIds = refs('brand')
  const prodIds = refs('product')

  // productos de las categorías/marcas con meta (para sumar su venta) y nombres para las etiquetas
  const [members, products, categories, brands] = await Promise.all([
    catIds.length + brandIds.length === 0 ? [] : prisma.product.findMany({
      where: { business_id: businessId, OR: [...(catIds.length ? [{ category_id: { in: catIds } }] : []), ...(brandIds.length ? [{ brand_id: { in: brandIds } }] : [])] },
      select: { id: true, category_id: true, brand_id: true },
    }),
    prodIds.length === 0 ? [] : prisma.product.findMany({ where: { business_id: businessId, id: { in: prodIds } }, select: { id: true, name: true } }),
    catIds.length === 0 ? [] : prisma.category.findMany({ where: { business_id: businessId, id: { in: catIds } }, select: { id: true, name: true } }),
    brandIds.length === 0 ? [] : prisma.brand.findMany({ where: { business_id: businessId, id: { in: brandIds } }, select: { id: true, name: true } }),
  ])
  const names = {
    product: new Map(products.map(p => [p.id, p.name])),
    category: new Map(categories.map(c => [c.id, c.name])),
    brand: new Map(brands.map(b => [b.id, b.name])),
  }

  const sumFor = (scope: GoalScope, refId: number): NetProductLine => {
    if (scope === 'product') return net.get(refId) ?? ZERO
    return members
      .filter(m => (scope === 'category' ? m.category_id : m.brand_id) === refId)
      .reduce((a, m) => {
        const n = net.get(m.id) ?? ZERO
        return { qty: a.qty + n.qty, usd: a.usd + n.usd, bs: a.bs + n.bs }
      }, ZERO)
  }

  const today = businessDateKey()
  return goals.map(g => {
    const s = sumFor(g.scope, g.ref_id)
    const actual = g.metric === 'units' ? r3(s.qty) : r2(s.usd)
    const target = Number(g.target.toString())
    return {
      id: g.id, scope: g.scope, ref_id: g.ref_id, label: names[g.scope].get(g.ref_id) ?? `#${g.ref_id}`,
      period: g.period, metric: g.metric, target, actual, ...goalProgress(target, actual, g.period, today),
    }
  }).sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

export async function getGoals(businessId: number, period: string): Promise<SalesGoalItem[]> {
  const goals = await prisma.salesGoal.findMany({ where: { business_id: businessId, period }, orderBy: { id: 'asc' } })
  return buildGoalItems(businessId, period, goals)
}

export async function getGoalItem(businessId: number, id: number): Promise<SalesGoalItem | null> {
  const goal = await prisma.salesGoal.findFirst({ where: { id, business_id: businessId } })
  if (!goal) return null
  return (await buildGoalItems(businessId, goal.period, [goal]))[0] ?? null
}
