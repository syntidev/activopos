import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ProfitRow = { costo: string | null }
type RateRow   = { rate: string | number }

function generateInsight(
  ventasNetas: number,
  margenBrutoPct: number,
  margenNetoPct: number,
  utilidadNeta: number,
  porCobrarCount: number,
  porCobrarUsd: number,
): string {
  if (ventasNetas === 0) return 'Sin ventas registradas para este período.'
  if (utilidadNeta < 0) {
    return `Pérdida neta de $${Math.abs(utilidadNeta).toFixed(2)}. Los gastos operativos superan el margen bruto.`
  }
  const parts: string[] = []
  if (margenBrutoPct >= 40) {
    parts.push(`Margen bruto sólido de ${margenBrutoPct.toFixed(1)}%.`)
  } else if (margenBrutoPct < 20) {
    parts.push(`Margen bruto bajo (${margenBrutoPct.toFixed(1)}%). Revisar precios o costos.`)
  }
  if (porCobrarCount > 0) {
    parts.push(`${porCobrarCount} venta${porCobrarCount > 1 ? 's' : ''} a crédito por cobrar ($${porCobrarUsd.toFixed(2)}).`)
  }
  if (parts.length === 0) {
    return `Utilidad neta de $${utilidadNeta.toFixed(2)} con margen de ${margenNetoPct.toFixed(1)}%.`
  }
  return parts.join(' ')
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const monthParam = sp.get('month') ?? ''
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(monthParam)

  const now = new Date()
  const year  = monthMatch ? parseInt(monthMatch[1], 10) : now.getFullYear()
  const month = monthMatch ? parseInt(monthMatch[2], 10) - 1 : now.getMonth()

  const from = new Date(year, month, 1)
  const to   = new Date(year, month + 1, 1)

  const bid = session.businessId

  const [
    ingresosAgg,
    costosRow,
    gastosAgg,
    porCobrarAgg,
    porPagarAgg,
    rateRows,
  ] = await Promise.all([
    // Ingresos: ventas pagadas del mes
    prisma.sale.aggregate({
      where: { business_id: bid, status: 'paid', sold_at: { gte: from, lt: to } },
      _sum: { total_usd: true, total_bs: true },
    }),
    // Costo de ventas: sum(qty × cost_per_unit)
    prisma.$queryRaw<ProfitRow[]>`
      SELECT SUM(si.quantity * IFNULL(p.cost_per_unit_usd, 0)) AS costo
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.business_id = ${bid}
        AND s.status = 'paid'
        AND s.sold_at >= ${from}
        AND s.sold_at <  ${to}`,
    // Gastos operativos del mes
    prisma.gasto.aggregate({
      where: { business_id: bid, fecha: { gte: from, lt: to } },
      _sum: { monto_usd: true },
    }),
    // Por cobrar: ventas pendientes (saldo total)
    prisma.sale.aggregate({
      where: { business_id: bid, status: 'pending' },
      _sum: { total_usd: true },
      _count: { id: true },
    }),
    // Por pagar: gastos no pagados
    prisma.gasto.aggregate({
      where: { business_id: bid, is_paid: false },
      _sum: { monto_usd: true },
      _count: { id: true },
    }),
    prisma.$queryRaw<RateRow[]>`SELECT rate FROM dollar_rates ORDER BY created_at DESC LIMIT 1`,
  ])

  const rate          = parseFloat(String(rateRows[0]?.rate ?? '36.50')) || 36.50
  const r2            = (x: number) => Math.round(x * 100) / 100

  const ventasNetas   = Number(ingresosAgg._sum.total_usd ?? 0)
  const ventasNetaBs  = Number(ingresosAgg._sum.total_bs  ?? 0)
  const costoVentas   = parseFloat(String(costosRow[0]?.costo ?? '0')) || 0
  const gastosOp      = Number(gastosAgg._sum.monto_usd   ?? 0)

  const utilidadBruta = r2(ventasNetas - costoVentas)
  const margenBruto   = ventasNetas > 0 ? r2((utilidadBruta / ventasNetas) * 100) : 0
  const utilidadNeta  = r2(utilidadBruta - gastosOp)
  const margenNeto    = ventasNetas > 0 ? r2((utilidadNeta / ventasNetas) * 100) : 0

  const porCobrarUsd  = Number(porCobrarAgg._sum.total_usd ?? 0)
  const porCobrarCnt  = porCobrarAgg._count.id
  const porPagarUsd   = Number(porPagarAgg._sum.monto_usd  ?? 0)
  const porPagarCnt   = porPagarAgg._count.id

  return NextResponse.json({
    ok: true,
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    rate,
    ingresos_totales: { usd: ventasNetas, bs: ventasNetaBs },
    gastos_totales:   { usd: r2(gastosOp),     bs: r2(gastosOp     * rate) },
    por_cobrar:       { usd: r2(porCobrarUsd), bs: r2(porCobrarUsd * rate), count: porCobrarCnt },
    por_pagar:        { usd: r2(porPagarUsd),  bs: r2(porPagarUsd  * rate), count: porPagarCnt },
    estado_resultados: {
      ventas_netas:         r2(ventasNetas),
      ventas_netas_bs:      ventasNetaBs,
      costo_ventas:         r2(costoVentas),
      costo_ventas_bs:      r2(costoVentas   * rate),
      utilidad_bruta:       utilidadBruta,
      utilidad_bruta_bs:    r2(utilidadBruta * rate),
      margen_bruto_pct:     margenBruto,
      gastos_operativos:    r2(gastosOp),
      gastos_operativos_bs: r2(gastosOp      * rate),
      utilidad_neta:        utilidadNeta,
      utilidad_neta_bs:     r2(utilidadNeta  * rate),
      margen_neto_pct:      margenNeto,
    },
    insight: generateInsight(ventasNetas, margenBruto, margenNeto, utilidadNeta, porCobrarCnt, porCobrarUsd),
  })
}
