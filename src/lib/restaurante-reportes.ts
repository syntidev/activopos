import { z } from 'zod'
import { businessDateKey, businessRange } from '@/lib/business-day'
import { tableSalesNet, tipsByWaiter, type MoneyTotals, type TableSaleNet } from '@/lib/sales-returns'
import type { TenantPrisma } from '@/lib/prisma-tenant'
import type { ReportMoneyDTO, ReportSalesRowDTO, ReportStationDTO, ReportTipRowDTO, RestauranteReportDTO } from '@/types/restaurante'

/**
 * Reportes del restaurante (R5). El DINERO sale de lib/sales-returns.ts (ventas netas y propinas): aquí no se repite ningún filtro de
 * status ni se rehacen restas. Lo que sí se calcula aquí no es dinero: rotación de mesas y tiempos por estación (p50/p90).
 */

const KEY = /^\d{4}-\d{2}-\d{2}$/
export const MAX_RANGE_DAYS = 366
const ITEM_LIMIT = 20_000
const r2 = (n: number): number => Math.round(n * 100) / 100
const r1 = (n: number): number => Math.round(n * 10) / 10

export const reportQuerySchema = z.object({
  from: z.string().regex(KEY, 'Fecha inválida (AAAA-MM-DD)').optional(),
  to:   z.string().regex(KEY, 'Fecha inválida (AAAA-MM-DD)').optional(),
})

/** Rango de días del negocio (hoy por defecto). */
export function resolveRange(from?: string, to?: string): { from: string; to: string; start: Date; end: Date } | { error: string } {
  const today = businessDateKey()
  const f = from ?? to ?? today
  const t = to ?? from ?? today
  if (f > t) return { error: 'La fecha inicial es posterior a la final' }
  const r = businessRange(f, t)
  if ((r.end.getTime() - r.start.getTime()) / 86_400_000 > MAX_RANGE_DAYS) return { error: `El rango máximo es de ${MAX_RANGE_DAYS} días` }
  return { from: f, to: t, start: r.start, end: r.end }
}

/** Percentil por rango más cercano sobre valores en minutos; null sin datos. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return r1(sorted[idx])
}

const money = (m: MoneyTotals): ReportMoneyDTO => ({ usd: m.usd, bs: m.bs })
const add = (a: ReportMoneyDTO, b: ReportMoneyDTO): ReportMoneyDTO => ({ usd: r2(a.usd + b.usd), bs: r2(a.bs + b.bs) })

function groupSales(rows: readonly TableSaleNet[], key: (r: TableSaleNet) => { id: number | null; name: string }): ReportSalesRowDTO[] {
  const by = new Map<string, ReportSalesRowDTO>()
  for (const r of rows) {
    const k = key(r)
    const id = `${k.id}`
    const cur = by.get(id) ?? { id: k.id, name: k.name, sales: 0, net: { usd: 0, bs: 0 } }
    cur.sales += 1
    cur.net = add(cur.net, money(r.net))
    by.set(id, cur)
  }
  return Array.from(by.values()).sort((a, b) => b.net.usd - a.net.usd)
}

const minutes = (a: Date, b: Date): number => (b.getTime() - a.getTime()) / 60_000

const average = (xs: readonly number[]): number | null => (xs.length === 0 ? null : r1(xs.reduce((a, b) => a + b, 0) / xs.length))

async function rotation(db: TenantPrisma, start: Date, end: Date): Promise<RestauranteReportDTO['rotation']> {
  const [closed, tables] = await Promise.all([
    db.order.findMany({
      where:  { origin: 'table', account_status: 'closed', closed_at: { gte: start, lt: end } },
      select: { opened_at: true, closed_at: true, table: { select: { area: { select: { name: true } } } } },
      take:   ITEM_LIMIT,
    }),
    db.diningTable.count({ where: { active: true } }),
  ])
  const all: number[] = []
  const byArea = new Map<string, { closed: number; mins: number[] }>()
  for (const o of closed) {
    const area = o.table?.area.name ?? 'Sin área'
    const cur = byArea.get(area) ?? { closed: 0, mins: [] }
    cur.closed += 1
    if (o.opened_at && o.closed_at) { const m = minutes(o.opened_at, o.closed_at); all.push(m); cur.mins.push(m) }
    byArea.set(area, cur)
  }
  return {
    closed_accounts: closed.length,
    active_tables:   tables,
    turns_per_table: tables > 0 ? r1(closed.length / tables) : null,
    avg_minutes:     average(all),
    by_area:         Array.from(byArea.entries()).map(([area, v]) => ({ area, closed: v.closed, avg_minutes: average(v.mins) })).sort((a, b) => b.closed - a.closed),
  }
}

async function stationTimes(db: TenantPrisma, start: Date, end: Date): Promise<ReportStationDTO[]> {
  const items = await db.orderItem.findMany({
    where:  { station_id: { not: null }, sent_at: { gte: start, lt: end }, ready_at: { not: null }, kds_status: { in: ['ready', 'served'] }, order: { origin: 'table' } },
    select: { station_id: true, sent_at: true, started_at: true, ready_at: true },
    take:   ITEM_LIMIT,
  })
  const stations = await db.prepStation.findMany({ select: { id: true, name: true }, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] })
  const wait = new Map<number, number[]>(), prep = new Map<number, number[]>(), total = new Map<number, number[]>(), count = new Map<number, number>()
  const push = (m: Map<number, number[]>, id: number, v: number): void => { m.set(id, [...(m.get(id) ?? []), v]) }
  for (const it of items) {
    if (it.station_id === null || !it.sent_at || !it.ready_at) continue
    count.set(it.station_id, (count.get(it.station_id) ?? 0) + 1)
    push(total, it.station_id, minutes(it.sent_at, it.ready_at))
    if (it.started_at) { push(wait, it.station_id, minutes(it.sent_at, it.started_at)); push(prep, it.station_id, minutes(it.started_at, it.ready_at)) }
  }
  return stations.map(s => ({
    id: s.id, name: s.name, items: count.get(s.id) ?? 0,
    wait_p50: percentile(wait.get(s.id) ?? [], 50), wait_p90: percentile(wait.get(s.id) ?? [], 90),
    prep_p50: percentile(prep.get(s.id) ?? [], 50), prep_p90: percentile(prep.get(s.id) ?? [], 90),
    total_p50: percentile(total.get(s.id) ?? [], 50), total_p90: percentile(total.get(s.id) ?? [], 90),
  }))
}

/** Reporte completo del rango. Admin: lo valida la ruta. */
export async function buildReport(db: TenantPrisma, businessId: number, from: string, to: string, start: Date, end: Date): Promise<RestauranteReportDTO> {
  const [sales, tips, rot, stations] = await Promise.all([
    tableSalesNet(businessId, start, end),
    tipsByWaiter(businessId, start, end),
    rotation(db, start, end),
    stationTimes(db, start, end),
  ])
  const total = sales.reduce((a, r) => add(a, money(r.net)), { usd: 0, bs: 0 })
  const tipRows: ReportTipRowDTO[] = tips
    .map(t => ({ id: t.waiterId, name: t.waiterName ?? 'Sin mesonero', count: t.count, cash: money(t.cash), other: money(t.other), total: add(money(t.cash), money(t.other)) }))
    .sort((a, b) => b.total.usd - a.total.usd)
  const cash  = tipRows.reduce((a, r) => add(a, r.cash), { usd: 0, bs: 0 })
  const other = tipRows.reduce((a, r) => add(a, r.other), { usd: 0, bs: 0 })
  return {
    from, to,
    net_sales: {
      total, sales: sales.length,
      by_waiter: groupSales(sales, r => ({ id: r.waiterId, name: r.waiterName ?? 'Sin mesonero' })),
      by_area:   groupSales(sales, r => ({ id: r.areaId, name: r.areaName ?? 'Sin área' })),
    },
    rotation: rot,
    stations,
    tips: { total: add(cash, other), cash, other, by_waiter: tipRows },
  }
}
