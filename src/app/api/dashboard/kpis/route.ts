import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { netByProduct, netCogs, netSales } from '@/lib/sales-returns'
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
type ProductRow = { product_id: number; name: string; qty: string; total_usd: string }
type CxcRow     = { client_name: string | null; total_usd: string; created_at: Date }
type StockRow   = { cnt: BigIntable }
type RateRow    = { rate: string | number }

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()

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

  const [
    vtHoy, vtAyer, vtMes, vtMesAnt, vtPeriodo,
    cgHoy, cgAyer, cgMes, cgMesAnt, cgPeriodo,
    netoProdMes,
    cancellations, creditToday,
    methodsRows, topProductsRows, cxcRows, stockRows,
    rateRows, creditAggToday, ordenesCount,
  ] = await Promise.all([
    // Ingreso neto y COGS neto por ventana -- fuente única (src/lib/sales-returns.ts).
    // Reemplaza 5 aggregates + 3 counts + 5 raws de utilidad que replicaban el
    // filtro de status y dejaban fuera las ventas con devolución parcial.
    netSales(bid, todayStart, tomorrowStart),
    netSales(bid, yesterdayStart, todayStart),
    netSales(bid, monthStart),
    netSales(bid, prevMonthStart, monthStart),
    netSales(bid, pFrom, pTo),
    netCogs(bid, todayStart, tomorrowStart),
    netCogs(bid, yesterdayStart, todayStart),
    netCogs(bid, monthStart),
    netCogs(bid, prevMonthStart, monthStart),
    netCogs(bid, pFrom, pTo),
    netByProduct(bid, monthStart),
    // Operativo
    db.sale.aggregate({
      where: { status: 'cancelled', updated_at: { gte: todayStart, lt: tomorrowStart } }, // business_id inyectado
      _count: { id: true },
      _sum:   { total_usd: true },
    }),
    db.sale.count({
      where: { origin: 'credit', created_at: { gte: todayStart, lt: tomorrowStart } }, // business_id inyectado
    }),
    // Payment methods breakdown for today
    prisma.$queryRaw<MethodRow[]>`
      SELECT pm.name AS method_name,
             SUM(sp.amount_usd) AS total_usd, SUM(sp.amount_bs) AS total_bs, COUNT(*) AS cnt
      FROM sale_payments sp
      JOIN payment_methods pm ON pm.id=sp.payment_method_id
      JOIN sales s ON s.id=sp.sale_id
      WHERE s.business_id=${bid} AND s.status IN ('paid','partial_return')
        AND s.sold_at>=${todayStart} AND s.sold_at<${tomorrowStart}
      GROUP BY pm.id, pm.name ORDER BY total_usd DESC`,
    // Top 10 products this month
    prisma.$queryRaw<ProductRow[]>`
      SELECT si.product_id, p.name, SUM(si.quantity) AS qty, SUM(si.subtotal_usd) AS total_usd
      FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id
      WHERE s.business_id=${bid} AND s.status IN ('paid','partial_return') AND s.sold_at>=${monthStart}
      GROUP BY si.product_id, p.name ORDER BY total_usd DESC LIMIT 10`,
    // CxC alerts: oldest pending credit sales
    prisma.$queryRaw<CxcRow[]>`
      SELECT IFNULL(c.name, s.client_name) AS client_name, s.total_usd, s.created_at
      FROM sales s LEFT JOIN clients c ON c.id=s.client_id
      WHERE s.business_id=${bid} AND s.status='credit'
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
    // Ventas a crédito (pending) creadas hoy — para coherencia dashboard
    db.sale.aggregate({
      where: { status: 'credit', created_at: { gte: todayStart, lt: tomorrowStart } }, // business_id inyectado
      _sum:  { total_usd: true },
    }),
    // Órdenes recibidas hoy
    db.order.count({
      where: { created_at: { gte: todayStart, lt: tomorrowStart } }, // business_id inyectado
    }),
  ])

  const rate = parseFloat(String(rateRows[0]?.rate ?? '36.50')) || 36.50
  const nowMs = now.getTime()

  const r2 = (x: number) => Math.round(x * 100) / 100

  const vHoy   = vtHoy.net.usd;      const vHoyBs = vtHoy.net.bs
  const vAyer  = vtAyer.net.usd
  const vMes   = vtMes.net.usd;      const vMesBs = vtMes.net.bs
  const vMesA  = vtMesAnt.net.usd
  const vPer   = vtPeriodo.net.usd;  const vPerBs = vtPeriodo.net.bs

  const todayCount  = vtHoy.salesCount
  const monthCount  = vtMes.salesCount
  const periodCount = vtPeriodo.salesCount

  // Utilidad = ingreso neto − COGS neto (el costo de lo devuelto se revierte
  // con el snapshot de ReturnItem).
  const uHoy   = r2(vHoy  - cgHoy.netUsd);   const uAyer = r2(vAyer - cgAyer.netUsd)
  const uMes   = r2(vMes  - cgMes.netUsd);   const uMesA = r2(vMesA - cgMesAnt.netUsd)
  const uPer   = r2(vPer  - cgPeriodo.netUsd)

  const creditoHoy        = Number(creditAggToday._sum.total_usd ?? 0)
  const costoInvertidoHoy = cgHoy.netUsd

  // Utilidad y costo son datos financieros — cashier no tiene acceso (mismo
  // criterio que /api/finanzas/* y api/sales/route.ts). Se omiten los campos en
  // vez de bloquear el endpoint completo, para no romper el resto del payload.
  const isCashier = session.role === 'cashier'

  return NextResponse.json({
    ok:       true,
    greeting: getGreeting(now.getHours()),
    kpis: {
      cobrado_usd:        vHoy,
      credito_usd:        creditoHoy,
      total_usd:          r2(vHoy + creditoHoy),
      ...(isCashier ? {} : {
        utilidad_usd:        r2(uHoy),
        costo_invertido_usd: r2(costoInvertidoHoy),
      }),
      tickets_count:      todayCount,
      ticket_promedio_usd: todayCount > 0 ? r2(vHoy / todayCount) : 0,
      ordenes_count:      ordenesCount,
    },
    rate,
    ventas_hoy: {
      usd: vHoy, bs: vHoyBs, count: todayCount,
      trend_pct: calcTrend(vHoy, vAyer),
    },
    ...(isCashier ? {} : {
      utilidad_hoy: {
        usd: uHoy, bs: r2(uHoy * rate),
        trend_pct: calcTrend(uHoy, uAyer),
      },
    }),
    ventas_mes: {
      usd: vMes, bs: vMesBs, count: monthCount,
      trend_pct: calcTrend(vMes, vMesA),
    },
    ...(isCashier ? {} : {
      utilidad_mes: {
        usd: uMes, bs: r2(uMes * rate),
        trend_pct: calcTrend(uMes, uMesA),
      },
    }),
    period_stats: {
      ventas:        { usd: vPer, bs: vPerBs },
      ...(isCashier ? {} : { utilidad: { usd: uPer, bs: r2(uPer * rate) } }),
      transacciones: periodCount,
      ticket_promedio: {
        usd: periodCount > 0 ? r2(vPer  / periodCount) : 0,
        bs:  periodCount > 0 ? r2(vPerBs / periodCount) : 0,
      },
    },
    operativo: {
      total_ventas_hoy:   todayCount,
      devoluciones_hoy:   Number(cancellations._count.id ?? 0),
      devoluciones_usd:   Number(cancellations._sum.total_usd ?? 0),
      ventas_credito_hoy: creditToday,
      stock_bajo:         Number(stockRows[0]?.cnt ?? 0),
    },
    cxc_alertas: cxcRows.map(row => {
      const vencimientoMs = new Date(row.created_at).getTime() + 30 * 86_400_000
      const tusd = parseFloat(String(row.total_usd))
      return {
        client_name:  row.client_name ?? 'Sin nombre',
        total_usd:    tusd,
        total_bs:     r2(tusd * rate),
        vencimiento:  new Date(vencimientoMs).toISOString().split('T')[0],
        dias_vencido: Math.max(0, Math.floor((nowMs - vencimientoMs) / 86_400_000)),
      }
    }),
    // Netos por producto: el ranking se arma tras restar lo devuelto.
    top_productos: topProductsRows
      .map(p => {
        const netoP = netoProdMes.get(Number(p.product_id))
        return {
          name:      p.name,
          qty:       netoP?.netQty ?? parseFloat(String(p.qty)),
          total_usd: netoP?.netUsd ?? parseFloat(String(p.total_usd)),
        }
      })
      .filter(p => p.qty > 0 || p.total_usd > 0)
      .sort((a, b) => b.total_usd - a.total_usd)
      .map((p, i) => ({
        name:      p.name,
        qty:       p.qty,
        total_usd: r2(p.total_usd),
        total_bs:  r2(p.total_usd * rate),
        rank:      i + 1,
      })),
    ventas_por_metodo: methodsRows.map(m => ({
      method_name: m.method_name,
      total_usd:   parseFloat(String(m.total_usd)),
      total_bs:    parseFloat(String(m.total_bs)),
      count:       Number(m.cnt),
    })),
  })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
