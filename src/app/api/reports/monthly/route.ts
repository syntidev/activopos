import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { REALIZED_SALE_STATUSES, returnedTotalsBySaleDate } from '@/lib/sales-returns'

const periodSchema = z.string().regex(/^\d{4}-\d{2}$/)

type DayRow = {
  day:       string
  total_usd: string | number
  count:     string | number
}

type WeekRow = {
  week:      number
  total_usd: string | number
  count:     string | number
}

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const periodParam =
    req.nextUrl.searchParams.get('period') ??
    new Date().toISOString().slice(0, 7)

  if (!periodSchema.safeParse(periodParam).success) {
    return NextResponse.json({ error: 'Período inválido (YYYY-MM)' }, { status: 400 })
  }

  const [year, month] = periodParam.split('-').map(Number)
  const monthStart    = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const monthEnd      = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))

  const [salesAgg, dailyRaw, weeklyRaw, returnedTotals, returnedDailyRaw, returnedWeeklyRaw, report] = await Promise.all([
    db.sale.aggregate({
      where: {
        // business_id inyectado por el tenant layer
        // partial_return incluido y neteado con returnedTotals (ver lib/sales-returns.ts).
        status:      { in: [...REALIZED_SALE_STATUSES] },
        sold_at:     { gte: monthStart, lt: monthEnd },
      },
      _sum:   { total_usd: true, total_bs: true },
      _count: { id: true },
    }),

    prisma.$queryRaw<DayRow[]>`
      SELECT DATE_FORMAT(sold_at, '%Y-%m-%d') AS day,
             SUM(total_usd) AS total_usd,
             COUNT(*)       AS count
      FROM sales
      WHERE business_id = ${session.businessId}
        AND status IN ('paid','partial_return')
        AND sold_at >= ${monthStart}
        AND sold_at < ${monthEnd}
      GROUP BY day
      ORDER BY day ASC
    `,

    prisma.$queryRaw<WeekRow[]>`
      SELECT WEEK(sold_at, 1) AS week,
             SUM(total_usd)   AS total_usd,
             COUNT(*)          AS count
      FROM sales
      WHERE business_id = ${session.businessId}
        AND status IN ('paid','partial_return')
        AND sold_at >= ${monthStart}
        AND sold_at < ${monthEnd}
      GROUP BY WEEK(sold_at, 1)
      ORDER BY week ASC
    `,

    returnedTotalsBySaleDate(session.businessId, monthStart, monthEnd),

    // Devuelto con el MISMO GROUP BY que cada serie (DATE_FORMAT / WEEK(.,1)),
    // para restar por clave idéntica sin recalcular fechas en JS.
    prisma.$queryRaw<{ day: string; devuelto_usd: string | number }[]>`
      SELECT DATE_FORMAT(s.sold_at, '%Y-%m-%d') AS day, SUM(r.total_usd) AS devuelto_usd
      FROM returns r JOIN sales s ON s.id = r.sale_id
      WHERE r.business_id = ${session.businessId}
        AND r.status = 'approved'
        AND s.status IN ('paid','partial_return')
        AND s.sold_at >= ${monthStart} AND s.sold_at < ${monthEnd}
      GROUP BY day
    `,
    prisma.$queryRaw<{ week: number; devuelto_usd: string | number }[]>`
      SELECT WEEK(s.sold_at, 1) AS week, SUM(r.total_usd) AS devuelto_usd
      FROM returns r JOIN sales s ON s.id = r.sale_id
      WHERE r.business_id = ${session.businessId}
        AND r.status = 'approved'
        AND s.status IN ('paid','partial_return')
        AND s.sold_at >= ${monthStart} AND s.sold_at < ${monthEnd}
      GROUP BY WEEK(s.sold_at, 1)
    `,

    prisma.monthlyReport.findUnique({
      where: {
        business_id_period: {
          business_id: session.businessId,
          period:      periodParam,
        },
      },
      select: {
        id:               true,
        status:           true,
        download_token:   true,
        token_expires_at: true,
        generated_at:     true,
      },
    }),
  ])

  const devueltoPorDia    = new Map(returnedDailyRaw.map(r => [String(r.day), Number(r.devuelto_usd)]))
  const devueltoPorSemana = new Map(returnedWeeklyRaw.map(r => [Number(r.week), Number(r.devuelto_usd)]))

  const days = dailyRaw.map(d => ({
    day:       d.day,
    total_usd: Number(d.total_usd) - (devueltoPorDia.get(String(d.day)) ?? 0),
    count:     parseInt(String(d.count), 10),
  }))

  const bestDay  = days.reduce((a, b) => (b.total_usd > a.total_usd ? b : a), days[0] ?? { day: null, total_usd: 0, count: 0 })
  const worstDay = days.reduce((a, b) => (b.total_usd < a.total_usd ? b : a), days[0] ?? { day: null, total_usd: 0, count: 0 })

  let download_url: string | null = null
  if (
    report?.status === 'ready' &&
    report.download_token &&
    report.token_expires_at &&
    report.token_expires_at > new Date()
  ) {
    download_url = `/api/r/${report.download_token}`
  }

  return NextResponse.json({
    ok:          true,
    period:      periodParam,
    sales_count: salesAgg._count.id,
    total_usd:   Number(salesAgg._sum.total_usd ?? 0) - returnedTotals.usd,
    total_bs:    Number(salesAgg._sum.total_bs  ?? 0) - returnedTotals.bs,
    best_day:    days.length ? bestDay  : null,
    worst_day:   days.length ? worstDay : null,
    by_day:      days,
    by_week:     weeklyRaw.map(w => ({
      week:      Number(w.week),
      total_usd: Number(w.total_usd) - (devueltoPorSemana.get(Number(w.week)) ?? 0),
      count:     parseInt(String(w.count), 10),
    })),
    report_status:  report?.status ?? null,
    report_id:      report?.id     ?? null,
    generated_at:   report?.generated_at ?? null,
    download_url,
  })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
