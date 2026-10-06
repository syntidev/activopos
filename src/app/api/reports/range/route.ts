import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { netCogs, netSales, returnedUsdBySeries } from '@/lib/sales-returns'
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

// daykey: misma expresión que usa la fuente única para agrupar por día, para
// restar lo devuelto con la clave idéntica. NO se expone en la respuesta: el
// campo público sigue siendo `date` con el mismo formato de antes.
type DayRow = { date: string; daykey: string; sales: string | number; total_usd: string | number }

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const sp     = req.nextUrl.searchParams
    const parsed = rangeSchema.safeParse({ from: sp.get('from'), to: sp.get('to') })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parámetros inválidos', issues: parsed.error.issues }, { status: 400 })
    }

    const { from: fromStr, to: toStr } = parsed.data
    const bid  = session.businessId
    const from = new Date(`${fromStr}T00:00:00Z`)
    const to   = new Date(`${toStr}T23:59:59.999Z`)

    // `to` viene inclusivo (23:59:59.999); la fuente única usa fin exclusivo.
    const toExclusive = new Date(to.getTime() + 1)

    const [ventas, cogs, byDayRows, devueltoPorDia] = await Promise.all([
      // Ingreso y COGS netos -- fuente única (src/lib/sales-returns.ts).
      netSales(bid, from, toExclusive),
      netCogs(bid, from, toExclusive),

      prisma.$queryRaw<DayRow[]>`
        SELECT DATE(sold_at) AS date,
               DATE_FORMAT(sold_at, '%Y-%m-%d') AS daykey,
               COUNT(*)      AS sales,
               SUM(total_usd) AS total_usd
        FROM sales
        WHERE business_id = ${bid}
          AND status IN ('paid','partial_return')
          AND sold_at >= ${from}
          AND sold_at <= ${to}
        GROUP BY DATE(sold_at), DATE_FORMAT(sold_at, '%Y-%m-%d')
        ORDER BY date ASC`,

      returnedUsdBySeries(bid, 'day', from, toExclusive),
    ])

    return NextResponse.json({
      ok:          true,
      from:        fromStr,
      to:          toStr,
      sales_count: ventas.salesCount,
      total_usd:   ventas.net.usd,
      total_bs:    ventas.net.bs,
      // Utilidad neta: ingreso neto − COGS neto (el costo de lo devuelto se
      // revierte con el snapshot de ReturnItem).
      profit_usd:  Math.round((ventas.net.usd - cogs.netUsd) * 100) / 100,
      by_day: byDayRows.map(r => ({
        date:        String(r.date),
        sales_count: Number(r.sales),
        total_usd:   Math.round((Number(r.total_usd) - (devueltoPorDia.get(String(r.daykey)) ?? 0)) * 100) / 100,
      })),
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
