import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const sp  = req.nextUrl.searchParams
  const raw = sp.get('period') ?? sp.get('month') ?? ''
  const m   = /^(\d{4})-(\d{2})$/.exec(raw)
  const now = new Date()
  const year  = m ? parseInt(m[1], 10) : now.getFullYear()
  const month = m ? parseInt(m[2], 10) : now.getMonth() + 1

  const from = new Date(year, month - 1, 1)
  const to   = new Date(year, month, 1)
  const bid  = session.businessId

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

  const ventasUsd      = Number(ventasAgg._sum.total_usd ?? 0)
  const costoVariable  = parseFloat(String(costoRow[0]?.costo ?? '0')) || 0
  const gastosFijos    = Number(gastosAgg._sum.monto_usd ?? 0)

  const r2 = (x: number) => Math.round(x * 100) / 100

  // Margen de contribución: (ventas - costo_variable) / ventas
  const margenContribPct = ventasUsd > 0
    ? r2(((ventasUsd - costoVariable) / ventasUsd) * 100)
    : 0

  // Punto de equilibrio: gastos_fijos / margen_contribucion
  const puntoEquilibrio = margenContribPct > 0
    ? r2(gastosFijos / (margenContribPct / 100))
    : 0

  // Días del período
  const diasTotales       = Math.floor((to.getTime() - from.getTime()) / 86_400_000)
  const isCurrentMonth    = now.getFullYear() === year && (now.getMonth() + 1) === month
  const diasTranscurridos = isCurrentMonth ? now.getDate() : diasTotales
  const ventasDiarias     = diasTranscurridos > 0 ? r2(ventasUsd / diasTranscurridos) : 0
  const proyeccion        = r2(ventasDiarias * diasTotales)

  // Estado
  const superado      = puntoEquilibrio > 0 && ventasUsd >= puntoEquilibrio
  const progresoPct   = puntoEquilibrio > 0
    ? Math.min(100, r2((ventasUsd / puntoEquilibrio) * 100))
    : (ventasUsd > 0 ? 100 : 0)

  return NextResponse.json({
    ok:           true,
    period_label: `${MONTH_NAMES[month - 1]} ${year}`,

    // Inputs
    ventas_usd:          r2(ventasUsd),
    costo_variable_usd:  r2(costoVariable),
    gastos_fijos_usd:    r2(gastosFijos),

    // Cálculo
    margen_contribucion_pct: margenContribPct,
    punto_equilibrio_usd:    puntoEquilibrio,

    // Estado
    superado,
    progreso_pct:   progresoPct,
    faltante_usd:   !superado && puntoEquilibrio > 0 ? r2(puntoEquilibrio - ventasUsd) : null,
    excedente_usd:  superado  ? r2(ventasUsd - puntoEquilibrio) : null,

    // Proyección
    dias_transcurridos:          diasTranscurridos,
    dias_totales:                diasTotales,
    ventas_diarias_promedio:     ventasDiarias,
    proyeccion_fin_mes_usd:      proyeccion,
    alcanzara_pe:                puntoEquilibrio > 0 ? proyeccion >= puntoEquilibrio : true,
  })
}
