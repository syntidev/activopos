import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { netSales } from '@/lib/sales-returns'
import { businessDateKey, businessDayStart, businessMonthKey, businessMonthRange, shiftDateKey } from '@/lib/business-day'

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

type PeriodType = 'week' | 'month' | 'quarter'
type Range = { from: Date; to: Date; label: string }

function getISOWeek(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  const tmp = new Date(Date.UTC(y, m - 1, d))
  const day = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7)
}

// Todos los rangos se arman con claves de día en hora del negocio (America/Caracas).
function keyRange(fromKey: string, toKey: string, label: string): Range {
  return { from: businessDayStart(fromKey), to: businessDayStart(toKey), label }
}

function buildWeekRanges(n: number): Range[] {
  const today = businessDateKey()
  const dow   = new Date(`${today}T00:00:00Z`).getUTCDay()
  const thisMonday = shiftDateKey(today, -(dow === 0 ? 6 : dow - 1))

  return Array.from({ length: n }, (_, i) => {
    const monday = shiftDateKey(thisMonday, -(n - 1 - i) * 7)
    return keyRange(monday, shiftDateKey(monday, 7), `Sem ${getISOWeek(monday)}`)
  })
}

function buildMonthRanges(n: number): Range[] {
  return Array.from({ length: n }, (_, i) => {
    const key = businessMonthKey(new Date(), n - 1 - i)
    const { start, end } = businessMonthRange(key)
    const [y, m] = key.split('-').map(Number)
    return { from: start, to: end, label: `${MONTH_SHORT[m - 1]} ${y}` }
  })
}

function buildQuarterRanges(n: number): Range[] {
  const [y0, m0] = businessDateKey().split('-').map(Number)
  const currentQ = Math.floor((m0 - 1) / 3)
  return Array.from({ length: n }, (_, i) => {
    const offset = n - 1 - i
    let q    = currentQ - offset
    let year = y0
    while (q < 0) { q += 4; year-- }
    const pad = (x: number) => String(x).padStart(2, '0')
    const fromKey = `${year}-${pad(q * 3 + 1)}-01`
    const toKey   = q === 3 ? `${year + 1}-01-01` : `${year}-${pad(q * 3 + 4)}-01`
    return keyRange(fromKey, toKey, `Q${q + 1} ${year}`)
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

    // Ventas netas por rango -- fuente única (src/lib/sales-returns.ts). Son 12
    // rangos fijos en paralelo, mismo patrón que ya usaba este endpoint.
    const results = await Promise.all(
      ranges.map(({ from, to }) => netSales(session.businessId, from, to)),
    )

    const r2 = (x: number) => Math.round(x * 100) / 100

    const data = ranges.map(({ from, to, label }, i) => {
      const agg   = results[i]
      const total = agg.net.usd
      const count = agg.salesCount
      return {
        label,
        from:           businessDateKey(from),
        to:             businessDateKey(to),
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
