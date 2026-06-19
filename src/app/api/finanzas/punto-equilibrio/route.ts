import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MONTH_NAMES, parsePeriodFromParams } from '@/lib/finanzas'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const { year, month } = parsePeriodFromParams(req.nextUrl.searchParams)
  const from = new Date(year, month - 1, 1)
  const to   = new Date(year, month, 1)
  const bid  = session.businessId
  const now  = new Date()

  const [ventasAgg, costoRow, gastosAgg] = await Promise.all([
    prisma.sale.aggregate({
      where: { business_id: bid, status: 'paid', sold_at: { gte: from, lt: to } },
      _sum:  { total_usd: true },
      _count: { id: true },
    }),

    prisma.$queryRaw<{ costo: string | null }[]>`
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

  const ventasUsd     = Number(ventasAgg._sum.total_usd ?? 0)
  const costoVariable = parseFloat(String(costoRow[0]?.costo ?? '0')) || 0
  const gastosFijos   = Number(gastosAgg._sum.monto_usd ?? 0)
  const r2            = (x: number) => Math.round(x * 100) / 100
  const periodLabel   = `${MONTH_NAMES[month - 1]} ${year}`

  const margenContribPct = ventasUsd > 0
    ? r2(((ventasUsd - costoVariable) / ventasUsd) * 100)
    : 0

  // Early return: margen negativo o cero — empresa no puede alcanzar PE con precios actuales
  if (margenContribPct <= 0) {
    return NextResponse.json({
      ok:                       true,
      period_label:             periodLabel,
      ventas_usd:               r2(ventasUsd),
      costo_variable_usd:       r2(costoVariable),
      gastos_fijos_usd:         r2(gastosFijos),
      margen_contribucion_pct:  margenContribPct,
      punto_equilibrio_usd:     null,
      superado:                 false,
      progreso_pct:             0,
      faltante_usd:             null,
      excedente_usd:            null,
      sin_margen:               true,
      mensaje:                  'El costo de ventas supera los ingresos — revisar precios',
      dias_transcurridos:       now.getMonth() + 1 === month && now.getFullYear() === year ? now.getDate() : Math.floor((to.getTime() - from.getTime()) / 86_400_000),
      dias_totales:             Math.floor((to.getTime() - from.getTime()) / 86_400_000),
      ventas_diarias_promedio:  0,
      proyeccion_fin_mes_usd:   0,
      alcanzara_pe:             false,
    })
  }

  // PE normal: margen > 0
  const puntoEquilibrio = r2(gastosFijos / (margenContribPct / 100))

  const diasTotales       = Math.floor((to.getTime() - from.getTime()) / 86_400_000)
  const isCurrentMonth    = now.getFullYear() === year && (now.getMonth() + 1) === month
  const diasTranscurridos = isCurrentMonth ? now.getDate() : diasTotales
  const ventasDiarias     = diasTranscurridos > 0 ? r2(ventasUsd / diasTranscurridos) : 0
  const proyeccion        = r2(ventasDiarias * diasTotales)

  // superado: ventas >= PE (si PE=0 y ventas>=0, cualquier ingreso lo supera)
  const superado    = ventasUsd >= puntoEquilibrio
  const progresoPct = Math.min(
    puntoEquilibrio > 0 ? r2((ventasUsd / puntoEquilibrio) * 100) : 0,
    100
  )

  return NextResponse.json({
    ok:                       true,
    period_label:             periodLabel,
    ventas_usd:               r2(ventasUsd),
    costo_variable_usd:       r2(costoVariable),
    gastos_fijos_usd:         r2(gastosFijos),
    margen_contribucion_pct:  margenContribPct,
    punto_equilibrio_usd:     puntoEquilibrio,
    superado,
    progreso_pct:             progresoPct,
    faltante_usd:             !superado && puntoEquilibrio > 0 ? r2(puntoEquilibrio - ventasUsd) : null,
    excedente_usd:            superado ? r2(ventasUsd - puntoEquilibrio) : null,
    sin_margen:               false,
    mensaje:                  null,
    dias_transcurridos:       diasTranscurridos,
    dias_totales:             diasTotales,
    ventas_diarias_promedio:  ventasDiarias,
    proyeccion_fin_mes_usd:   proyeccion,
    alcanzara_pe:             puntoEquilibrio > 0 ? proyeccion >= puntoEquilibrio : true,
  })
}
