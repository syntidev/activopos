import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcTrend, getGreeting } from '@/lib/dashboard'

type Period = 'today' | '7d' | '30d' | '12m'

interface PeriodBounds { from: Date; to: Date }

function getPeriodBounds(period: Period): PeriodBounds {
  const now = new Date()
  const todayStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000)

  switch (period) {
    case '7d': {
      return { from: new Date(todayStart.getTime() - 6 * 86_400_000), to: tomorrowStart }
    }
    case '30d': {
      return { from: new Date(todayStart.getTime() - 29 * 86_400_000), to: tomorrowStart }
    }
    case '12m': {
      return { from: new Date(now.getFullYear() - 1, now.getMonth(), 1), to: tomorrowStart }
    }
    default: {
      return { from: todayStart, to: tomorrowStart }
    }
  }
}

type ProfitRow  = { profit: string | null }
type BigIntable = string | bigint
type MethodRow  = { method_name: string; total_usd: string; total_bs: string; cnt: BigIntable }
type ProductRow = { name: string; qty: string; total_usd: string }
type CxcRow     = { client_name: string | null; total_usd: string; created_at: Date }
type StockRow   = { cnt: BigIntable }
type RateRow    = { rate: string | number }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const raw = sp.get('period') ?? 'today'
  const period: Period = (['today', '7d', '30d', '12m'] as const).includes(raw as Period)
    ? (raw as Period)
    : 'today'

  const bid = session.businessId
  const now = new Date()

  const todayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart  = new Date(todayStart.getTime() + 86_400_000)
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000)
  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const { from: pFrom, to: pTo } = getPeriodBounds(period)

  const paidToday     = { business_id: bid, status: 'paid' as const, sold_at: { gte: todayStart,     lt: tomorrowStart  } }
  const paidYesterday = { business_id: bid, status: 'paid' as const, sold_at: { gte: yesterdayStart, lt: todayStart      } }
  const paidMonth     = { business_id: bid, status: 'paid' as const, sold_at: { gte: monthStart                         } }
  const paidPrevMonth = { business_id: bid, status: 'paid' as const, sold_at: { gte: prevMonthStart, lt: monthStart      } }
  const paidPeriod    = { business_id: bid, status: 'paid' as const, sold_at: { gte: pFrom,          lt: pTo             } }

  const [
    todayAgg, yesterdayAgg, monthAgg, prevMonthAgg, periodAgg,
    todayCount, monthCount, periodCount,
    todayP, yesterdayP, monthP, prevMonthP, periodP,
    cancellations, creditToday,
    methodsRows, topProductsRows, cxcRows, stockRows,
    rateRows,
  ] = await Promise.all([
    // Revenue aggregates
    prisma.sale.aggregate({ where: paidToday,     _sum: { total_usd: true, total_bs: true } }),
    prisma.sale.aggregate({ where: paidYesterday, _sum: { total_usd: true, total_bs: true } }),
    prisma.sale.aggregate({ where: paidMonth,     _sum: { total_usd: true, total_bs: true } }),
    prisma.sale.aggregate({ where: paidPrevMonth, _sum: { total_usd: true, total_bs: true } }),
    prisma.sale.aggregate({ where: paidPeriod,    _sum: { total_usd: true, total_bs: true } }),
    // Counts
    prisma.sale.count({ where: paidToday }),
    prisma.sale.count({ where: paidMonth }),
    prisma.sale.count({ where: paidPeriod }),
    // Profit (revenue − COGS) via raw SQL
    prisma.$queryRaw<ProfitRow[]>`
      SELECT SUM(si.subtotal_usd - si.quantity * IFNULL(p.cost_per_unit_usd,0)) AS profit
      FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id
      WHERE s.business_id=${bid} AND s.status='paid'
        AND s.sold_at>=${todayStart} AND s.sold_at<${tomorrowStart}`,
    prisma.$queryRaw<ProfitRow[]>`
      SELECT SUM(si.subtotal_usd - si.quantity * IFNULL(p.cost_per_unit_usd,0)) AS profit
      FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id
      WHERE s.business_id=${bid} AND s.status='paid'
        AND s.sold_at>=${yesterdayStart} AND s.sold_at<${todayStart}`,
    prisma.$queryRaw<ProfitRow[]>`
      SELECT SUM(si.subtotal_usd - si.quantity * IFNULL(p.cost_per_unit_usd,0)) AS profit
      FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id
      WHERE s.business_id=${bid} AND s.status='paid' AND s.sold_at>=${monthStart}`,
    prisma.$queryRaw<ProfitRow[]>`
      SELECT SUM(si.subtotal_usd - si.quantity * IFNULL(p.cost_per_unit_usd,0)) AS profit
      FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id
      WHERE s.business_id=${bid} AND s.status='paid'
        AND s.sold_at>=${prevMonthStart} AND s.sold_at<${monthStart}`,
    prisma.$queryRaw<ProfitRow[]>`
      SELECT SUM(si.subtotal_usd - si.quantity * IFNULL(p.cost_per_unit_usd,0)) AS profit
      FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id
      WHERE s.business_id=${bid} AND s.status='paid'
        AND s.sold_at>=${pFrom} AND s.sold_at<${pTo}`,
    // Operativo
    prisma.sale.aggregate({
      where: { business_id: bid, status: 'cancelled', updated_at: { gte: todayStart, lt: tomorrowStart } },
      _count: { id: true },
      _sum:   { total_usd: true },
    }),
    prisma.sale.count({
      where: { business_id: bid, origin: 'credit', created_at: { gte: todayStart, lt: tomorrowStart } },
    }),
    // Payment methods breakdown for today
    prisma.$queryRaw<MethodRow[]>`
      SELECT pm.name AS method_name,
             SUM(sp.amount_usd) AS total_usd, SUM(sp.amount_bs) AS total_bs, COUNT(*) AS cnt
      FROM sale_payments sp
      JOIN payment_methods pm ON pm.id=sp.payment_method_id
      JOIN sales s ON s.id=sp.sale_id
      WHERE s.business_id=${bid} AND s.sold_at>=${todayStart} AND s.sold_at<${tomorrowStart}
      GROUP BY pm.id, pm.name ORDER BY total_usd DESC`,
    // Top 10 products this month
    prisma.$queryRaw<ProductRow[]>`
      SELECT p.name, SUM(si.quantity) AS qty, SUM(si.subtotal_usd) AS total_usd
      FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id
      WHERE s.business_id=${bid} AND s.status='paid' AND s.sold_at>=${monthStart}
      GROUP BY si.product_id, p.name ORDER BY total_usd DESC LIMIT 10`,
    // CxC alerts: oldest pending credit sales
    prisma.$queryRaw<CxcRow[]>`
      SELECT IFNULL(c.name, s.client_name) AS client_name, s.total_usd, s.created_at
      FROM sales s LEFT JOIN clients c ON c.id=s.client_id
      WHERE s.business_id=${bid} AND s.status='pending'
      ORDER BY s.created_at ASC LIMIT 10`,
    // Stock bajo
    prisma.$queryRaw<StockRow[]>`
      SELECT COUNT(*) AS cnt FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(quantity)-SUM(waste) AS net_qty
        FROM inventory_entries WHERE business_id=${bid} GROUP BY product_id
      ) ie ON ie.product_id=p.id
      WHERE p.business_id=${bid} AND p.active=1
        AND IFNULL(ie.net_qty,0) < p.min_stock AND p.min_stock>0`,
    // BCV rate
    prisma.$queryRaw<RateRow[]>`SELECT rate FROM dollar_rates ORDER BY created_at DESC LIMIT 1`,
  ])

  const rate = parseFloat(String(rateRows[0]?.rate ?? '36.50')) || 36.50
  const nowMs = now.getTime()

  const n  = (v: unknown) => Number(v ?? 0)
  const p0 = (rows: ProfitRow[]) => parseFloat(rows[0]?.profit ?? '0') || 0
  const r2 = (x: number) => Math.round(x * 100) / 100

  const vHoy   = n(todayAgg._sum.total_usd);    const vHoyBs  = n(todayAgg._sum.total_bs)
  const vAyer  = n(yesterdayAgg._sum.total_usd)
  const vMes   = n(monthAgg._sum.total_usd);     const vMesBs  = n(monthAgg._sum.total_bs)
  const vMesA  = n(prevMonthAgg._sum.total_usd)
  const vPer   = n(periodAgg._sum.total_usd);    const vPerBs  = n(periodAgg._sum.total_bs)

  const uHoy   = p0(todayP);    const uAyer  = p0(yesterdayP)
  const uMes   = p0(monthP);    const uMesA  = p0(prevMonthP)
  const uPer   = p0(periodP)

  return NextResponse.json({
    ok:       true,
    greeting: getGreeting(now.getHours()),
    rate,
    ventas_hoy: {
      usd: vHoy, bs: vHoyBs, count: todayCount,
      trend_pct: calcTrend(vHoy, vAyer),
    },
    utilidad_hoy: {
      usd: uHoy, bs: r2(uHoy * rate),
      trend_pct: calcTrend(uHoy, uAyer),
    },
    ventas_mes: {
      usd: vMes, bs: vMesBs, count: monthCount,
      trend_pct: calcTrend(vMes, vMesA),
    },
    utilidad_mes: {
      usd: uMes, bs: r2(uMes * rate),
      trend_pct: calcTrend(uMes, uMesA),
    },
    period_stats: {
      ventas:        { usd: vPer, bs: vPerBs },
      utilidad:      { usd: uPer, bs: r2(uPer * rate) },
      transacciones: periodCount,
      ticket_promedio: {
        usd: periodCount > 0 ? r2(vPer  / periodCount) : 0,
        bs:  periodCount > 0 ? r2(vPerBs / periodCount) : 0,
      },
    },
    operativo: {
      total_ventas_hoy:   todayCount,
      devoluciones_hoy:   n(cancellations._count.id),
      devoluciones_usd:   n(cancellations._sum.total_usd),
      ventas_credito_hoy: creditToday,
      stock_bajo:         Number(stockRows[0]?.cnt ?? 0),
    },
    cxc_alertas: cxcRows.map(row => {
      const vencimientoMs = new Date(row.created_at).getTime() + 30 * 86_400_000
      return {
        client_name:  row.client_name ?? 'Sin nombre',
        total_usd:    parseFloat(String(row.total_usd)),
        vencimiento:  new Date(vencimientoMs).toISOString().split('T')[0],
        dias_vencido: Math.max(0, Math.floor((nowMs - vencimientoMs) / 86_400_000)),
      }
    }),
    top_productos: topProductsRows.map((p, i) => ({
      name:      p.name,
      qty:       parseFloat(String(p.qty)),
      total_usd: parseFloat(String(p.total_usd)),
      rank:      i + 1,
    })),
    ventas_por_metodo: methodsRows.map(m => ({
      method_name: m.method_name,
      total_usd:   parseFloat(String(m.total_usd)),
      total_bs:    parseFloat(String(m.total_bs)),
      count:       Number(m.cnt),
    })),
  })
}
