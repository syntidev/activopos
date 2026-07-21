import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { checkPlanLimit, planDenied } from '@/lib/plan-guard'
import { prisma } from '@/lib/prisma'

const monthSchema = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/)

interface SalesRow  { date: Date | string; ingresos_usd: string | number }
interface GastosRow { date: Date | string; gastos_usd:   string | number }

function toDateKey(d: Date | string): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10)
  return String(d).slice(0, 10)
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const planGate = await checkPlanLimit('access_finanzas')
  if (!planGate.allowed) return planDenied(planGate.reason)

  const monthStr = req.nextUrl.searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
  if (!monthSchema.safeParse(monthStr).success) {
    return NextResponse.json({ error: 'Formato inválido. Use YYYY-MM' }, { status: 400 })
  }

  const [year, month] = monthStr.split('-').map(Number) as [number, number]
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const monthEnd   = new Date(Date.UTC(year, month,     1, 0, 0, 0, 0))
  const bid        = session.businessId

  const [salesRows, gastosRows] = await Promise.all([
    prisma.$queryRaw<SalesRow[]>`
      SELECT DATE(sold_at) AS date, SUM(total_usd) AS ingresos_usd
      FROM sales
      WHERE business_id = ${bid}
        AND status = 'paid'
        AND sold_at >= ${monthStart}
        AND sold_at < ${monthEnd}
      GROUP BY DATE(sold_at)
      ORDER BY date ASC`,

    prisma.$queryRaw<GastosRow[]>`
      SELECT fecha AS date, SUM(monto_usd) AS gastos_usd
      FROM gastos
      WHERE business_id = ${bid}
        AND fecha >= ${monthStart}
        AND fecha < ${monthEnd}
      GROUP BY fecha
      ORDER BY fecha ASC`,
  ])

  const dayMap = new Map<string, { ingresos_usd: number; gastos_usd: number }>()

  for (const row of salesRows) {
    const key = toDateKey(row.date)
    const slot = dayMap.get(key)
    if (slot) slot.ingresos_usd += Number(row.ingresos_usd)
    else dayMap.set(key, { ingresos_usd: Number(row.ingresos_usd), gastos_usd: 0 })
  }

  for (const row of gastosRows) {
    const key = toDateKey(row.date)
    const slot = dayMap.get(key)
    if (slot) slot.gastos_usd += Number(row.gastos_usd)
    else dayMap.set(key, { ingresos_usd: 0, gastos_usd: Number(row.gastos_usd) })
  }

  const r2 = (x: number) => Math.round(x * 100) / 100

  const days = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      ingresos_usd: r2(v.ingresos_usd),
      gastos_usd:   r2(v.gastos_usd),
      utilidad_usd: r2(v.ingresos_usd - v.gastos_usd),
    }))

  return NextResponse.json({ ok: true, days })
}
