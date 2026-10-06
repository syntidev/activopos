import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { netCogs, netSales } from '@/lib/sales-returns'
import { checkPlanLimit, planDenied } from '@/lib/plan-guard'
import { prisma } from '@/lib/prisma'
import { MONTH_NAMES, parsePeriodFromParams } from '@/lib/finanzas'

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    const planGate = await checkPlanLimit('access_finanzas')
    if (!planGate.allowed) return planDenied(planGate.reason)

    const { year, month } = parsePeriodFromParams(req.nextUrl.searchParams)
  const from = new Date(year, month - 1, 1)
  const to   = new Date(year, month, 1)
  const bid  = session.businessId
  const now  = new Date()

  const [ventasNetas, cogsNeto, costoRow, gastosAgg] = await Promise.all([
    // Ingreso y COGS netos -- fuente única (src/lib/sales-returns.ts). El
    // break-even se calcula sobre ingreso neto de devoluciones.
    netSales(bid, from, to),
    netCogs(bid, from, to),

    // ingresos_costeados: ingreso de líneas CON costo conocido, NETO de lo
    // devuelto de esas líneas -- denominador del margen de contribución.
    prisma.$queryRaw<{ ingresos_costeados: string | null }[]>`
      SELECT
        (SELECT IFNULL(SUM(si.subtotal_usd), 0)
           FROM sale_items si JOIN sales s ON s.id = si.sale_id
          WHERE s.business_id = ${bid} AND s.status IN ('paid','partial_return')
            AND si.cost_per_unit_usd IS NOT NULL
            AND s.sold_at >= ${from} AND s.sold_at < ${to})
        -
        (SELECT IFNULL(SUM(ri.total_usd), 0)
           FROM return_items ri
           JOIN returns r ON r.id = ri.return_id
           JOIN sales s   ON s.id = r.sale_id
           JOIN sale_items si2 ON si2.sale_id = s.id AND si2.product_id = ri.product_id
          WHERE r.business_id = ${bid} AND r.status = 'approved'
            AND s.status IN ('paid','partial_return')
            AND si2.cost_per_unit_usd IS NOT NULL
            AND s.sold_at >= ${from} AND s.sold_at < ${to})
        AS ingresos_costeados`,

    // Costos fijos excluyen categoria='proveedor' — esas compras ya cuentan como
    // costo variable vía COGS; contarlas aquí las duplicaría en el break-even (GAP-2).
    db.gasto.aggregate({
      where: { fecha: { gte: from, lt: to }, categoria: { not: 'proveedor' } }, // business_id inyectado
      _sum:  { monto_usd: true },
    }),
  ])

  const ventasUsd         = ventasNetas.net.usd
  const costoVariable     = cogsNeto.netUsd
  const ingresosCosteados = parseFloat(String(costoRow[0]?.ingresos_costeados ?? '0')) || 0
  const productosSinCosto = cogsNeto.productsWithoutCostCount
  const gastosFijos   = Number(gastosAgg._sum.monto_usd ?? 0)
  const r2            = (x: number) => Math.round(x * 100) / 100
  const periodLabel   = `${MONTH_NAMES[month - 1]} ${year}`

  const margenContribPct = ingresosCosteados > 0
    ? r2(((ingresosCosteados - costoVariable) / ingresosCosteados) * 100)
    : 0

  const diasTotalesMes = Math.floor((to.getTime() - from.getTime()) / 86_400_000)

  // Sin ventas en el período — distinto de "margen negativo": no hay pérdida, no hay datos.
  if (ventasUsd === 0) {
    return NextResponse.json({
      ok:                       true,
      period_label:             periodLabel,
      ventas_usd:               0,
      costo_variable_usd:       r2(costoVariable),
      gastos_fijos_usd:         r2(gastosFijos),
      margen_contribucion_pct:  0,
      punto_equilibrio_usd:     null,
      superado:                 false,
      progreso_pct:             0,
      faltante_usd:             null,
      excedente_usd:            null,
      sin_datos:                true,
      sin_margen:               false,
      mensaje:                  'Sin ventas registradas en este período',
      dias_transcurridos:       now.getMonth() + 1 === month && now.getFullYear() === year ? now.getDate() : diasTotalesMes,
      dias_totales:             diasTotalesMes,
      ventas_diarias_promedio:  0,
      proyeccion_fin_mes_usd:   0,
      alcanzara_pe:             false,
      productos_sin_costo:      productosSinCosto,
    })
  }

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
      productos_sin_costo:      productosSinCosto,
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
    productos_sin_costo:      productosSinCosto,
  })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
