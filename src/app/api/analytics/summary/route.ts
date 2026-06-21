import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type DailyRow = { date: string; total_usd: string | number }
type HourRow  = { hour: string | number; avg_usd: string | number }
type CostRow  = { costo: string | null }

function parseDate(str: string | null, fallback: Date): Date {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return fallback
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const sp  = req.nextUrl.searchParams
  const bid = session.businessId
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultTo   = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const from = parseDate(sp.get('from'), defaultFrom)
  const to   = parseDate(sp.get('to'),   defaultTo)

  if (to <= from) {
    return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 })
  }

  const days     = Math.ceil((to.getTime() - from.getTime()) / 86_400_000)
  const prevFrom = new Date(from.getTime() - days * 86_400_000)
  const prevTo   = from

  const [salesAgg, itemsAgg, payments, dailyRaw, hourlyRaw, prevAgg, costosRow, gastosOpAgg] = await Promise.all([
    prisma.sale.aggregate({
      where: { business_id: bid, status: 'paid', sold_at: { gte: from, lt: to } },
      _sum:   { total_usd: true, total_bs: true },
      _count: { id: true },
    }),

    prisma.saleItem.aggregate({
      where: { sale: { business_id: bid, status: 'paid', sold_at: { gte: from, lt: to } } },
      _sum: { quantity: true },
    }),

    prisma.salePayment.findMany({
      where: { sale: { business_id: bid, status: 'paid', sold_at: { gte: from, lt: to } } },
      include: { payment_method: { select: { id: true, name: true, type: true } } },
    }),

    prisma.$queryRaw<DailyRow[]>`
      SELECT DATE(sold_at) AS date, SUM(total_usd) AS total_usd
      FROM sales
      WHERE business_id = ${bid}
        AND status = 'paid'
        AND sold_at >= ${from}
        AND sold_at <  ${to}
      GROUP BY DATE(sold_at)
      ORDER BY total_usd DESC`,

    prisma.$queryRaw<HourRow[]>`
      SELECT HOUR(sold_at) AS hour, AVG(total_usd) AS avg_usd
      FROM sales
      WHERE business_id = ${bid}
        AND status = 'paid'
        AND sold_at >= ${from}
        AND sold_at <  ${to}
      GROUP BY HOUR(sold_at)
      ORDER BY avg_usd DESC
      LIMIT 1`,

    prisma.sale.aggregate({
      where: { business_id: bid, status: 'paid', sold_at: { gte: prevFrom, lt: prevTo } },
      _sum:   { total_usd: true },
      _count: { id: true },
    }),

    prisma.$queryRaw<CostRow[]>`
      SELECT SUM(si.quantity * IFNULL(p.cost_per_unit_usd, 0)) AS costo
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.business_id = ${bid}
        AND s.status = 'paid'
        AND s.sold_at >= ${from}
        AND s.sold_at <  ${to}`,

    prisma.gasto.aggregate({
      where: { business_id: bid, fecha: { gte: from, lt: to } },
      _sum:  { monto_usd: true },
    }),
  ])

  const r2 = (x: number) => Math.round(x * 100) / 100

  const totalUsd      = Number(salesAgg._sum.total_usd ?? 0)
  const totalBs       = Number(salesAgg._sum.total_bs  ?? 0)
  const count         = salesAgg._count.id
  const prevUsd       = Number(prevAgg._sum.total_usd ?? 0)
  const itemsSold     = Number(itemsAgg._sum.quantity  ?? 0)
  const costoVentas   = Number(costosRow[0]?.costo ?? 0)
  const gastosOp      = Number(gastosOpAgg._sum.monto_usd ?? 0)
  const utilidadBruta = r2(totalUsd - costoVentas)
  const utilidadNeta  = r2(totalUsd - costoVentas - gastosOp)

  const variacionPct: number =
    prevUsd > 0 ? r2(((totalUsd - prevUsd) / prevUsd) * 100) : 0
  const tendencia: 'up' | 'down' | 'stable' =
    Math.abs(variacionPct) < 1 ? 'stable' : variacionPct > 0 ? 'up' : 'down'

  // Agrupar pagos por método en JS
  const pmMap = new Map<number, { name: string; type: string; total_usd: number; count: number }>()
  for (const p of payments) {
    const entry = pmMap.get(p.payment_method_id)
    if (entry) {
      entry.total_usd += Number(p.amount_usd)
      entry.count++
    } else {
      pmMap.set(p.payment_method_id, {
        name:      p.payment_method.name,
        type:      p.payment_method.type,
        total_usd: Number(p.amount_usd),
        count:     1,
      })
    }
  }
  const totalPorMetodo = Array.from(pmMap.values()).reduce((s, v) => s + v.total_usd, 0)
  const porMetodo = Array.from(pmMap.values())
    .map(v => ({
      method_name: v.name,
      total_usd:   r2(v.total_usd),
      count:       v.count,
      pct:         totalPorMetodo > 0 ? r2((v.total_usd / totalPorMetodo) * 100) : 0,
    }))
    .sort((a, b) => b.total_usd - a.total_usd)

  // dailyRaw ordenado DESC: [0]=mejor, [last]=peor
  const mejorDia = dailyRaw[0] ?? null
  const peorDia  = dailyRaw.length > 1 ? dailyRaw[dailyRaw.length - 1] : null

  return NextResponse.json({
    ok: true,
    period: {
      from:  from.toISOString().slice(0, 10),
      to:    to.toISOString().slice(0, 10),
      days,
      label: `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`,
    },
    ventas: {
      total_usd:      r2(totalUsd),
      total_bs:       r2(totalBs),
      count,
      avg_ticket_usd: count > 0 ? r2(totalUsd / count) : 0,
      items_sold:     itemsSold,
    },
    vs_anterior: {
      total_usd:     r2(prevUsd),
      variacion_pct: variacionPct,
      tendencia,
    },
    mejor_dia: mejorDia
      ? { date: String(mejorDia.date), total_usd: r2(Number(mejorDia.total_usd)) }
      : null,
    peor_dia: peorDia
      ? { date: String(peorDia.date), total_usd: r2(Number(peorDia.total_usd)) }
      : null,
    mejor_hora: hourlyRaw[0]
      ? { hour: Number(hourlyRaw[0].hour), avg_usd: r2(Number(hourlyRaw[0].avg_usd)) }
      : null,
    resultado: {
      costo_ventas_usd:      r2(costoVentas),
      gastos_operativos_usd: r2(gastosOp),
      utilidad_bruta_usd:    utilidadBruta,
      utilidad_neta_usd:     utilidadNeta,
    },
    por_metodo:     porMetodo,
    dias_activos:   dailyRaw.length,
    dias_sin_venta: Math.max(0, days - dailyRaw.length),
  })
}
