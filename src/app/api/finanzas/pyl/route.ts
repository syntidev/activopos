import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

const r2 = (n: number) => Math.round(n * 100) / 100

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const fromParam = req.nextUrl.searchParams.get('from')
    const toParam   = req.nextUrl.searchParams.get('to')
    if (!fromParam || !toParam) {
      return NextResponse.json({ error: 'Parámetros from y to son requeridos (YYYY-MM-DD)' }, { status: 400 })
    }

    const from = new Date(fromParam)
    const to   = new Date(toParam)
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 })
    }
    const toExclusive = new Date(to.getTime() + 86_400_000) // 'to' es inclusivo — corta al inicio del día siguiente

    const bid = session.businessId

    const [ventasRow, opexAgg] = await Promise.all([
      // SaleItem no tiene business_id (tabla hija) — el tenant layer no lo aísla, se filtra a mano
      prisma.$queryRaw<{ ingresos: string | null; cogs: string | null }[]>`
        SELECT
          SUM(si.subtotal_usd) AS ingresos,
          SUM(si.quantity * IFNULL(si.cost_per_unit_usd, 0)) AS cogs
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.business_id = ${bid}
          AND s.status = 'paid'
          AND s.sold_at >= ${from}
          AND s.sold_at <  ${toExclusive}`,

      db.gasto.aggregate({
        where: { fecha: { gte: from, lt: toExclusive } }, // business_id inyectado por el tenant layer
        _sum:  { monto_usd: true },
      }),
    ])

    const ingresos = parseFloat(String(ventasRow[0]?.ingresos ?? '0')) || 0
    const cogs     = parseFloat(String(ventasRow[0]?.cogs     ?? '0')) || 0
    const opex     = Number(opexAgg._sum.monto_usd ?? 0)

    const utilidad_bruta = ingresos - cogs
    const utilidad_neta  = utilidad_bruta - opex
    const margen_bruto   = ingresos > 0 ? (utilidad_bruta / ingresos) * 100 : 0

    return NextResponse.json({
      ok: true,
      period: { from: fromParam, to: toParam },
      ingresos:       r2(ingresos),
      cogs:           r2(cogs),
      opex:           r2(opex),
      utilidad_bruta: r2(utilidad_bruta),
      utilidad_neta:  r2(utilidad_neta),
      margen_bruto:   r2(margen_bruto),
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
