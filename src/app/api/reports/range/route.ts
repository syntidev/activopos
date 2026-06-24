import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido')

const rangeSchema = z.object({
  from: dateStr,
  to:   dateStr,
}).superRefine((data, ctx) => {
  const f = new Date(data.from)
  const t = new Date(data.to)
  if (isNaN(f.getTime()) || isNaN(t.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fecha inválida' })
    return
  }
  if (f > t) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '"from" debe ser anterior o igual a "to"' })
  }
  const diffDays = (t.getTime() - f.getTime()) / 86_400_000
  if (diffDays > 90) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rango máximo 90 días' })
  }
})

type DayRow    = { date: string; sales: string | number; total_usd: string | number }
type ProfitRow = { profit: string | null }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const sp     = req.nextUrl.searchParams
  const parsed = rangeSchema.safeParse({ from: sp.get('from'), to: sp.get('to') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos', issues: parsed.error.issues }, { status: 400 })
  }

  const { from: fromStr, to: toStr } = parsed.data
  const bid  = session.businessId
  const from = new Date(`${fromStr}T00:00:00`)
  const to   = new Date(`${toStr}T23:59:59.999`)

  const [salesAgg, profitRows, byDayRows] = await Promise.all([
    prisma.sale.aggregate({
      where: { business_id: bid, status: 'paid', sold_at: { gte: from, lte: to } },
      _sum:   { total_usd: true, total_bs: true },
      _count: { id: true },
    }),

    prisma.$queryRaw<ProfitRow[]>`
      SELECT SUM(si.subtotal_usd - si.quantity * IFNULL(p.cost_per_unit_usd, 0)) AS profit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.business_id = ${bid}
        AND s.status = 'paid'
        AND s.sold_at >= ${from}
        AND s.sold_at <= ${to}`,

    prisma.$queryRaw<DayRow[]>`
      SELECT DATE(sold_at) AS date,
             COUNT(*)      AS sales,
             SUM(total_usd) AS total_usd
      FROM sales
      WHERE business_id = ${bid}
        AND status = 'paid'
        AND sold_at >= ${from}
        AND sold_at <= ${to}
      GROUP BY DATE(sold_at)
      ORDER BY date ASC`,
  ])

  return NextResponse.json({
    ok:          true,
    from:        fromStr,
    to:          toStr,
    sales_count: salesAgg._count.id,
    total_usd:   Number(salesAgg._sum.total_usd ?? 0),
    total_bs:    Number(salesAgg._sum.total_bs  ?? 0),
    profit_usd:  parseFloat(profitRows[0]?.profit ?? '0') || 0,
    by_day: byDayRows.map(r => ({
      date:      String(r.date),
      sales:     Number(r.sales),
      total_usd: Number(r.total_usd),
    })),
  })
}
