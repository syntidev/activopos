import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/**
 * FUENTE ÚNICA de totales monetarios de venta (estándar contable 2026-10-06).
 *
 *  1. Ventas netas = ventas brutas − devoluciones aprobadas.
 *  2. El ingreso se imputa a la FECHA DE LA VENTA (aunque la devolución sea
 *     posterior). El reembolso se imputa a CUÁNDO SALIÓ EL DINERO.
 *  3. COGS sale de SaleItem.cost_per_unit_usd y se revierte con el snapshot
 *     ReturnItem.cost_per_unit_usd.
 *  4. `partial_return` sigue contando en reportes y finanzas; `returned`
 *     (devolución total) se excluye: de esa venta no quedó nada.
 *  5. Solo los reembolsos con método de tipo 'cash' afectan el efectivo
 *     esperado de la caja.
 *
 * Ningún endpoint debe replicar estos filtros ni rehacer estas restas.
 */
export const REALIZED_SALE_STATUSES = ['paid', 'partial_return'] as const

/** Literal para $queryRaw: `AND s.status IN ('paid','partial_return')`. */
const REALIZED_SQL = Prisma.sql`('paid','partial_return')`

export interface MoneyTotals {
  usd: number
  bs:  number
}

export interface NetSales {
  gross:      MoneyTotals
  returned:   MoneyTotals
  net:        MoneyTotals
  salesCount: number
}

export interface NetCogs {
  grossUsd:    number
  returnedUsd: number
  netUsd:      number
  /**
   * Costo devuelto que NO se pudo revertir: devoluciones previas al estándar
   * (sin snapshot de costo) cuya línea no es identificable sin ambigüedad.
   * Se expone en vez de estimarlo, para que un reporte pueda avisar.
   */
  unresolvedReturnedUsd: number
  /**
   * Productos distintos vendidos en el período SIN costo capturado
   * (SaleItem.cost_per_unit_usd null). Su ingreso entra al margen con costo 0,
   * así que el reporte debe poder avisarlo.
   */
  productsWithoutCostCount: number
}

export interface NetDimension {
  netUsd:  number
  netQty:  number
  netCogs: number
}

type Range = { gte: Date; lt?: Date }
const range = (from: Date, to?: Date): Range => (to ? { gte: from, lt: to } : { gte: from })
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v))
const r2 = (x: number): number => Math.round(x * 100) / 100

/* ───────────────────────── Ventas netas ───────────────────────── */

export async function netSales(businessId: number, from: Date, to?: Date): Promise<NetSales> {
  const [salesAgg, returnsAgg] = await Promise.all([
    prisma.sale.aggregate({
      where:  { business_id: businessId, status: { in: [...REALIZED_SALE_STATUSES] }, sold_at: range(from, to) },
      _sum:   { total_usd: true, total_bs: true },
      _count: { id: true },
    }),
    prisma.return.aggregate({
      where: {
        business_id: businessId,
        status:      'approved',
        sale:        { status: { in: [...REALIZED_SALE_STATUSES] }, sold_at: range(from, to) },
      },
      _sum: { total_usd: true, total_bs: true },
    }),
  ])

  const gross    = { usd: num(salesAgg._sum.total_usd), bs: num(salesAgg._sum.total_bs) }
  const returned = { usd: num(returnsAgg._sum.total_usd), bs: num(returnsAgg._sum.total_bs) }

  return {
    gross,
    returned,
    net:        { usd: r2(gross.usd - returned.usd), bs: r2(gross.bs - returned.bs) },
    salesCount: salesAgg._count.id,
  }
}

/* ───────────────────────── COGS neto ───────────────────────── */

export async function netCogs(businessId: number, from: Date, to?: Date): Promise<NetCogs> {
  const to_ = to ?? null

  const [grossRows, returnedRows] = await Promise.all([
    prisma.$queryRaw<{ cogs: string | null; sin_costo: string | number | null }[]>`
      SELECT SUM(si.quantity * IFNULL(si.cost_per_unit_usd, 0)) AS cogs,
             COUNT(DISTINCT CASE WHEN si.cost_per_unit_usd IS NULL THEN si.product_id END) AS sin_costo
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.business_id = ${businessId}
        AND s.status IN ${REALIZED_SQL}
        AND s.sold_at >= ${from}
        ${to_ ? Prisma.sql`AND s.sold_at < ${to_}` : Prisma.empty}`,

    // Revierte con el snapshot de ReturnItem. Si falta (devolución previa al
    // estándar), cae al SaleItem SOLO cuando ese producto está en una única
    // línea de la venta; si hay varias, no se adivina: suma en `unresolved`.
    prisma.$queryRaw<{ reverted: string | null; unresolved: string | null }[]>`
      SELECT
        SUM(CASE
              WHEN ri.cost_per_unit_usd IS NOT NULL THEN ri.qty * ri.cost_per_unit_usd
              WHEN lines.n = 1 THEN ri.qty * IFNULL(lines.unit_cost, 0)
              ELSE 0
            END) AS reverted,
        SUM(CASE
              WHEN ri.cost_per_unit_usd IS NULL AND IFNULL(lines.n, 0) <> 1 THEN ri.total_usd
              ELSE 0
            END) AS unresolved
      FROM return_items ri
      JOIN returns r ON r.id = ri.return_id
      JOIN sales s   ON s.id = r.sale_id
      LEFT JOIN (
        SELECT si.sale_id, si.product_id, COUNT(*) AS n, MIN(si.cost_per_unit_usd) AS unit_cost
        FROM sale_items si
        GROUP BY si.sale_id, si.product_id
      ) lines ON lines.sale_id = s.id AND lines.product_id = ri.product_id
      WHERE r.business_id = ${businessId}
        AND r.status = 'approved'
        AND s.status IN ${REALIZED_SQL}
        AND s.sold_at >= ${from}
        ${to_ ? Prisma.sql`AND s.sold_at < ${to_}` : Prisma.empty}`,
  ])

  const grossUsd    = num(grossRows[0]?.cogs)
  const returnedUsd = num(returnedRows[0]?.reverted)

  return {
    grossUsd:              r2(grossUsd),
    returnedUsd:           r2(returnedUsd),
    netUsd:                r2(grossUsd - returnedUsd),
    unresolvedReturnedUsd: r2(num(returnedRows[0]?.unresolved)),
    productsWithoutCostCount: Math.trunc(num(grossRows[0]?.sin_costo)),
  }
}

/** Margen % sobre ingreso neto. 0 si no hubo ingreso (nunca divide por 0). */
export function marginPct(netRevenueUsd: number, netCogsUsd: number): number {
  if (netRevenueUsd <= 0) return 0
  return Math.round(((netRevenueUsd - netCogsUsd) / netRevenueUsd) * 10000) / 100
}

/* ──────────────────── Desgloses netos ──────────────────── */

async function dimensionRows(
  businessId: number,
  dimension: 'product' | 'category',
  from: Date,
  to?: Date,
): Promise<Map<string, NetDimension>> {
  const to_ = to ?? null
  const keyExpr = dimension === 'product'
    ? Prisma.sql`CAST(si.product_id AS CHAR)`
    : Prisma.sql`COALESCE(c.name, 'Sin categoría')`
  const keyExprRet = dimension === 'product'
    ? Prisma.sql`CAST(ri.product_id AS CHAR)`
    : Prisma.sql`COALESCE(c.name, 'Sin categoría')`

  const [sold, back] = await Promise.all([
    prisma.$queryRaw<{ k: string; usd: string | null; qty: string | null; cogs: string | null }[]>`
      SELECT ${keyExpr} AS k,
             SUM(si.subtotal_usd) AS usd,
             SUM(si.quantity)     AS qty,
             SUM(si.quantity * IFNULL(si.cost_per_unit_usd, 0)) AS cogs
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p   ON p.id = si.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.business_id = ${businessId}
        AND s.status IN ${REALIZED_SQL}
        AND s.sold_at >= ${from}
        ${to_ ? Prisma.sql`AND s.sold_at < ${to_}` : Prisma.empty}
      GROUP BY k`,

    prisma.$queryRaw<{ k: string; usd: string | null; qty: string | null; cogs: string | null }[]>`
      SELECT ${keyExprRet} AS k,
             SUM(ri.total_usd) AS usd,
             SUM(ri.qty)       AS qty,
             SUM(CASE
                   WHEN ri.cost_per_unit_usd IS NOT NULL THEN ri.qty * ri.cost_per_unit_usd
                   WHEN lines.n = 1 THEN ri.qty * IFNULL(lines.unit_cost, 0)
                   ELSE 0
                 END) AS cogs
      FROM return_items ri
      JOIN returns r ON r.id = ri.return_id
      JOIN sales s   ON s.id = r.sale_id
      LEFT JOIN products p   ON p.id = ri.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN (
        SELECT si.sale_id, si.product_id, COUNT(*) AS n, MIN(si.cost_per_unit_usd) AS unit_cost
        FROM sale_items si
        GROUP BY si.sale_id, si.product_id
      ) lines ON lines.sale_id = s.id AND lines.product_id = ri.product_id
      WHERE r.business_id = ${businessId}
        AND r.status = 'approved'
        AND s.status IN ${REALIZED_SQL}
        AND s.sold_at >= ${from}
        ${to_ ? Prisma.sql`AND s.sold_at < ${to_}` : Prisma.empty}
      GROUP BY k`,
  ])

  const backMap = new Map(back.map(b => [String(b.k), b]))
  const out = new Map<string, NetDimension>()
  for (const row of sold) {
    const k = String(row.k)
    const b = backMap.get(k)
    out.set(k, {
      netUsd:  r2(num(row.usd)  - num(b?.usd)),
      netQty:  num(row.qty)  - num(b?.qty),
      netCogs: r2(num(row.cogs) - num(b?.cogs)),
    })
  }
  return out
}

/** Neto por product_id. */
export async function netByProduct(businessId: number, from: Date, to?: Date): Promise<Map<number, NetDimension>> {
  const rows = await dimensionRows(businessId, 'product', from, to)
  const out = new Map<number, NetDimension>()
  for (const [k, v] of Array.from(rows.entries())) out.set(Number(k), v)
  return out
}

/** Neto por nombre de categoría (clave `'Sin categoría'` igual que los reportes). */
export function netByCategory(businessId: number, from: Date, to?: Date): Promise<Map<string, NetDimension>> {
  return dimensionRows(businessId, 'category', from, to)
}

/* ──────────────────── Series (día / semana / hora) ──────────────────── */

export type SeriesGranularity = 'day' | 'week' | 'hour' | 'month'

/**
 * Devuelto en USD agrupado con la MISMA expresión SQL que usan los reportes
 * (`DATE_FORMAT`, `WEEK(.,1)`, `HOUR()`), para restar por clave idéntica sin
 * recalcular fechas en JS (eso asumiría que el TZ de Node y el de MySQL
 * coinciden, y estos reportes mezclan rangos UTC con agrupación de servidor).
 */
export async function returnedUsdBySeries(
  businessId: number,
  granularity: SeriesGranularity,
  from: Date,
  to?: Date,
): Promise<Map<string, number>> {
  const to_ = to ?? null
  const rows = await returnedBySeries(businessId, granularity, from, to_ ?? undefined)
  return new Map(Array.from(rows.entries()).map(([k, v]) => [k, v.usd]))
}

export interface ReturnedSeriesBucket {
  usd:  number
  cogs: number
}

/**
 * Igual que returnedUsdBySeries pero también con el COGS devuelto por bucket,
 * para netear utilidad en series (ej. gráficos de ventas vs utilidad).
 */
export async function returnedBySeries(
  businessId: number,
  granularity: SeriesGranularity,
  from: Date,
  to?: Date,
): Promise<Map<string, ReturnedSeriesBucket>> {
  const to_ = to ?? null
  const expr =
    granularity === 'day'   ? Prisma.sql`DATE_FORMAT(s.sold_at, '%Y-%m-%d')` :
    granularity === 'month' ? Prisma.sql`DATE_FORMAT(s.sold_at, '%Y-%m')` :
    granularity === 'week'  ? Prisma.sql`WEEK(s.sold_at, 1)` :
                              Prisma.sql`HOUR(s.sold_at)`

  const rows = await prisma.$queryRaw<{ k: string | number; usd: string | null; cogs: string | null }[]>`
    SELECT ${expr} AS k,
           SUM(ri.total_usd) AS usd,
           SUM(CASE
                 WHEN ri.cost_per_unit_usd IS NOT NULL THEN ri.qty * ri.cost_per_unit_usd
                 WHEN lines.n = 1 THEN ri.qty * IFNULL(lines.unit_cost, 0)
                 ELSE 0
               END) AS cogs
    FROM return_items ri
    JOIN returns r ON r.id = ri.return_id
    JOIN sales s   ON s.id = r.sale_id
    LEFT JOIN (
      SELECT si.sale_id, si.product_id, COUNT(*) AS n, MIN(si.cost_per_unit_usd) AS unit_cost
      FROM sale_items si
      GROUP BY si.sale_id, si.product_id
    ) lines ON lines.sale_id = s.id AND lines.product_id = ri.product_id
    WHERE r.business_id = ${businessId}
      AND r.status = 'approved'
      AND s.status IN ${REALIZED_SQL}
      AND s.sold_at >= ${from}
      ${to_ ? Prisma.sql`AND s.sold_at < ${to_}` : Prisma.empty}
    GROUP BY k`

  return new Map(rows.map(r => [String(r.k), { usd: num(r.usd), cogs: num(r.cogs) }]))
}

/* ──────────────────── Caja ──────────────────── */

/**
 * Reembolsos que SALIERON del cajón en el rango. Anclado a `created_at` de la
 * devolución (cuándo salió el dinero), no a la fecha de la venta: devolver hoy
 * algo de ayer deja corto el cajón de HOY.
 *
 * Solo cuenta los de método tipo 'cash'. Las devoluciones previas al estándar
 * (sin método registrado) se siguen contando como efectivo: era la regla
 * vigente cuando se crearon, y cambiarla movería cuadres de caja ya cerrados.
 */
export async function cashRefundTotals(businessId: number, from: Date, to?: Date): Promise<MoneyTotals> {
  const agg = await prisma.return.aggregate({
    where: {
      business_id: businessId,
      status:      'approved',
      created_at:  range(from, to),
      sale:        { status: { in: [...REALIZED_SALE_STATUSES] } },
      OR: [
        { refund_payment_method: { type: 'cash' } },
        { refund_payment_method_id: null },
      ],
    },
    _sum: { total_usd: true, total_bs: true },
  })
  return { usd: r2(num(agg._sum.total_usd)), bs: r2(num(agg._sum.total_bs)) }
}

export interface ApprovedReturnRow {
  /** Cuándo se reembolsó — para imputarlo al turno de caja correcto. */
  refunded_at: Date
  /** Cuándo se vendió lo devuelto — para imputar el ingreso al período de la venta. */
  sold_at:     Date | null
  total_usd:   number
  total_bs:    number
  /** true solo si el reembolso salió en efectivo (o es previo al estándar). */
  is_cash:     boolean
}

/**
 * Lista plana de devoluciones aprobadas del rango, para repartirlas en memoria
 * entre varios turnos/días. Una sola query: nunca llamar cashRefundTotals()
 * dentro de un loop (N+1 que .doc/AGENTS.md prohíbe).
 */
export async function approvedReturnsInRange(
  businessId: number,
  from: Date,
  to?: Date,
): Promise<ApprovedReturnRow[]> {
  const rows = await prisma.return.findMany({
    where: {
      business_id: businessId,
      status:      'approved',
      created_at:  to ? { gte: from, lte: to } : { gte: from },
      sale:        { status: { in: [...REALIZED_SALE_STATUSES] } },
    },
    select: {
      created_at:               true,
      total_usd:                true,
      total_bs:                 true,
      refund_payment_method_id: true,
      refund_payment_method:    { select: { type: true } },
      sale:                     { select: { sold_at: true } },
    },
  })

  return rows.map(r => ({
    refunded_at: r.created_at,
    sold_at:     r.sale.sold_at,
    total_usd:   Number(r.total_usd),
    total_bs:    Number(r.total_bs),
    is_cash:     r.refund_payment_method_id === null || r.refund_payment_method?.type === 'cash',
  }))
}
