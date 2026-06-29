import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

type PeriodType = 'week' | 'month' | 'quarter'
type Range = { from: Date; to: Date; label: string }

function getISOWeek(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7)
}

function buildWeekRanges(n: number): Range[] {
  const now     = new Date()
  const dow     = now.getDay() === 0 ? 6 : now.getDay() - 1
  const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow)
  thisMonday.setHours(0, 0, 0, 0)

  return Array.from({ length: n }, (_, i) => {
    const monday = new Date(thisMonday.getTime() - (n - 1 - i) * 7 * 86_400_000)
    const sunday = new Date(monday.getTime() + 7 * 86_400_000)
    return { from: monday, to: sunday, label: `Sem ${getISOWeek(monday)}` }
  })
}

function buildMonthRanges(n: number): Range[] {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const monthsBack = n - 1 - i
    const d    = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
    const from = new Date(d.getFullYear(), d.getMonth(), 1)
    const to   = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    return { from, to, label: `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}` }
  })
}

function buildQuarterRanges(n: number): Range[] {
  const now      = new Date()
  const currentQ = Math.floor(now.getMonth() / 3)
  return Array.from({ length: n }, (_, i) => {
    const offset = n - 1 - i
    let q    = currentQ - offset
    let year = now.getFullYear()
    while (q < 0) { q += 4; year-- }
    const from = new Date(year, q * 3, 1)
    const to   = new Date(year, q * 3 + 3, 1)
    return { from, to, label: `Q${q + 1} ${year}` }
  })
}

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const raw = req.nextUrl.searchParams.get('period') ?? 'month'
    if (raw !== 'week' && raw !== 'month' && raw !== 'quarter') {
      return NextResponse.json({ error: 'period debe ser week, month o quarter' }, { status: 400 })
    }
    const periodType = raw as PeriodType

    const ranges =
      periodType === 'week'    ? buildWeekRanges(12)    :
      periodType === 'quarter' ? buildQuarterRanges(8)  :
                                 buildMonthRanges(12)

    const results = await Promise.all(
      ranges.map(({ from, to }) =>
        db.sale.aggregate({
          where: { status: 'paid', sold_at: { gte: from, lt: to } }, // business_id inyectado
          _sum:   { total_usd: true },
          _count: { id: true },
        })
      )
    )

    const r2 = (x: number) => Math.round(x * 100) / 100

    const data = ranges.map(({ from, to, label }, i) => {
      const agg   = results[i]
      const total = Number(agg._sum.total_usd ?? 0)
      const count = agg._count.id
      return {
        label,
        from:           from.toISOString().slice(0, 10),
        to:             to.toISOString().slice(0, 10),
        total_usd:      r2(total),
        count,
        avg_ticket_usd: count > 0 ? r2(total / count) : 0,
      }
    })

    const maxUsd    = Math.max(...data.map(d => d.total_usd), 0)
    const firstUsd  = data[0]?.total_usd ?? 0
    const lastUsd   = data[data.length - 1]?.total_usd ?? 0
    const growthPct = firstUsd > 0 ? r2(((lastUsd - firstUsd) / firstUsd) * 100) : 0

    return NextResponse.json({
      ok:          true,
      period_type: periodType,
      data,
      max_usd:     r2(maxUsd),
      growth_pct:  growthPct,
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
