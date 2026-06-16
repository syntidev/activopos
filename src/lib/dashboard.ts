import { prisma } from './prisma'

export interface KpiData {
  ventas_hoy:   { value_usd: number; trend_pct: number }
  utilidad_hoy: { value_usd: number; trend_pct: number }
  ventas_mes:   { value_usd: number; trend_pct: number }
  utilidad_mes: { value_usd: number; trend_pct: number }
  bcvRate:      number
}

export function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Buen día'
  if (hour >= 12 && hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

export function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

export function fmtBs(usd: number, rate: number): string {
  if (!rate) return ''
  return (
    'Bs. ' +
    (usd * rate).toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

export async function getKpiData(businessId: number): Promise<KpiData> {
  const now            = new Date()
  const todayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart  = new Date(todayStart.getTime() + 86_400_000)
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000)
  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  type ProfitRow = { profit: string | null }
  type RateRow   = { rate: string | number }

  const [
    todayAgg, yesterdayAgg, monthAgg, prevMonthAgg,
    todayP, yesterdayP, monthP, prevMonthP,
    rateRows,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { business_id: businessId, status: 'paid', sold_at: { gte: todayStart, lt: tomorrowStart } },
      _sum: { total_usd: true },
    }),
    prisma.sale.aggregate({
      where: { business_id: businessId, status: 'paid', sold_at: { gte: yesterdayStart, lt: todayStart } },
      _sum: { total_usd: true },
    }),
    prisma.sale.aggregate({
      where: { business_id: businessId, status: 'paid', sold_at: { gte: monthStart } },
      _sum: { total_usd: true },
    }),
    prisma.sale.aggregate({
      where: { business_id: businessId, status: 'paid', sold_at: { gte: prevMonthStart, lt: monthStart } },
      _sum: { total_usd: true },
    }),
    prisma.$queryRaw<ProfitRow[]>`
      SELECT SUM(si.subtotal_usd - si.quantity * IFNULL(p.cost_per_unit_usd, 0)) AS profit
      FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
      WHERE s.business_id = ${businessId} AND s.status = 'paid'
        AND s.sold_at >= ${todayStart} AND s.sold_at < ${tomorrowStart}
    `,
    prisma.$queryRaw<ProfitRow[]>`
      SELECT SUM(si.subtotal_usd - si.quantity * IFNULL(p.cost_per_unit_usd, 0)) AS profit
      FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
      WHERE s.business_id = ${businessId} AND s.status = 'paid'
        AND s.sold_at >= ${yesterdayStart} AND s.sold_at < ${todayStart}
    `,
    prisma.$queryRaw<ProfitRow[]>`
      SELECT SUM(si.subtotal_usd - si.quantity * IFNULL(p.cost_per_unit_usd, 0)) AS profit
      FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
      WHERE s.business_id = ${businessId} AND s.status = 'paid'
        AND s.sold_at >= ${monthStart}
    `,
    prisma.$queryRaw<ProfitRow[]>`
      SELECT SUM(si.subtotal_usd - si.quantity * IFNULL(p.cost_per_unit_usd, 0)) AS profit
      FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
      WHERE s.business_id = ${businessId} AND s.status = 'paid'
        AND s.sold_at >= ${prevMonthStart} AND s.sold_at < ${monthStart}
    `,
    prisma.$queryRaw<RateRow[]>`SELECT rate FROM dollar_rates ORDER BY created_at DESC LIMIT 1`,
  ])

  const bcvRate = parseFloat(String(rateRows[0]?.rate ?? '36.50')) || 36.50

  const vHoy    = Number(todayAgg._sum.total_usd ?? 0)
  const vAyer   = Number(yesterdayAgg._sum.total_usd ?? 0)
  const vMes    = Number(monthAgg._sum.total_usd ?? 0)
  const vMesAnt = Number(prevMonthAgg._sum.total_usd ?? 0)
  const uHoy    = parseFloat(todayP[0]?.profit    ?? '0') || 0
  const uAyer   = parseFloat(yesterdayP[0]?.profit ?? '0') || 0
  const uMes    = parseFloat(monthP[0]?.profit     ?? '0') || 0
  const uMesAnt = parseFloat(prevMonthP[0]?.profit ?? '0') || 0

  return {
    ventas_hoy:   { value_usd: vHoy,  trend_pct: calcTrend(vHoy,  vAyer)   },
    utilidad_hoy: { value_usd: uHoy,  trend_pct: calcTrend(uHoy,  uAyer)   },
    ventas_mes:   { value_usd: vMes,  trend_pct: calcTrend(vMes,  vMesAnt) },
    utilidad_mes: { value_usd: uMes,  trend_pct: calcTrend(uMes,  uMesAnt) },
    bcvRate,
  }
}
