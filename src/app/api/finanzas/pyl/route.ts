import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { netCogs, netSales } from '@/lib/sales-returns'
import { checkPlanLimit, planDenied } from '@/lib/plan-guard'
import { businessDateKey, businessDayRange, businessDayStart, businessMonthKey, businessMonthRange, shiftDateKey } from '@/lib/business-day'

const r2 = (n: number) => Math.round(n * 100) / 100
const fmtDate = (d: Date) => businessDateKey(d)

// 'YYYY-MM-DD' → medianoche de ese día en hora del negocio (America/Caracas).
function parseLocalDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = businessDayStart(s)
  return isNaN(d.getTime()) ? null : d
}

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    const planGate = await checkPlanLimit('access_finanzas')
    if (!planGate.allowed) return planDenied(planGate.reason)

    const fromParam   = req.nextUrl.searchParams.get('from')
    const toParam     = req.nextUrl.searchParams.get('to')
    const periodParam = req.nextUrl.searchParams.get('period')

    let from: Date
    let toExclusive: Date

    if (periodParam) {
      const todayKey   = businessDateKey()
      const { start: todayStart, end: todayEnd } = businessDayRange(todayKey)
      toExclusive = todayEnd // hasta el final de hoy

      if (periodParam === 'hoy') {
        from = todayStart
      } else if (periodParam === '7dias') {
        from = businessDayStart(shiftDateKey(todayKey, -6))
      } else if (periodParam === 'mes') {
        from = businessMonthRange(businessMonthKey()).start
      } else if (periodParam === 'anio') {
        from = businessDayStart(`${todayKey.slice(0, 4)}-01-01`)
      } else {
        return NextResponse.json({ error: 'period inválido (hoy|7dias|mes|anio)' }, { status: 400 })
      }
    } else {
      if (!fromParam || !toParam) {
        return NextResponse.json({ error: 'Parámetros from y to son requeridos (YYYY-MM-DD)' }, { status: 400 })
      }
      const fromParsed = parseLocalDate(fromParam)
      const toParsed   = parseLocalDate(toParam)
      if (!fromParsed || !toParsed) {
        return NextResponse.json({ error: 'Fechas inválidas (formato YYYY-MM-DD)' }, { status: 400 })
      }
      from = fromParsed
      toExclusive = new Date(toParsed.getTime() + 86_400_000) // 'to' es inclusivo — corta al inicio del día siguiente
    }

    const bid = session.businessId
    // gastos.fecha es DATE (medianoche UTC): se compara con las claves de día.
    const gastoFrom = new Date(`${businessDateKey(from)}T00:00:00Z`)
    const gastoTo   = new Date(`${businessDateKey(toExclusive)}T00:00:00Z`)

    const [ventasNetas, cogsNeto, opexAgg] = await Promise.all([
      // Ingreso y COGS netos -- fuente única (src/lib/sales-returns.ts).
      netSales(bid, from, toExclusive),
      netCogs(bid, from, toExclusive),
      // OPEX excluye categoria='proveedor': una compra de inventario a crédito es
      // COGS al vender (via SaleItem), NO gasto operativo. Contarla aquí duplicaría
      // el costo (GAP-2). Decisión de negocio: Compra ≠ Gasto.
      db.gasto.aggregate({
        where: { fecha: { gte: gastoFrom, lt: gastoTo }, categoria: { not: 'proveedor' } }, // business_id inyectado por el tenant layer
        _sum:  { monto_usd: true },
      }),
    ])

    // Ingreso y COGS netos -- fuente única (src/lib/sales-returns.ts).
    const ingresos          = ventasNetas.net.usd
    const cogs              = cogsNeto.netUsd
    // Ingreso neto de líneas con costo conocido -- fuente única sales-returns (cost_unknown fuera de utilidad y margen).
    const ingresosCosteados = cogsNeto.costedNetUsd
    const productosSinCosto = cogsNeto.productsWithoutCostCount
    const opex     = Number(opexAgg._sum.monto_usd ?? 0)

    const utilidad_bruta = ingresosCosteados - cogs
    const utilidad_neta  = utilidad_bruta - opex
    // margen_bruto calculado solo sobre ventas con costo conocido (ver nota arriba)
    const margen_bruto   = ingresosCosteados > 0
      ? ((ingresosCosteados - cogs) / ingresosCosteados) * 100
      : 0

    return NextResponse.json({
      ok: true,
      period: { from: fmtDate(from), to: fmtDate(new Date(toExclusive.getTime() - 86_400_000)) },
      ingresos:       r2(ingresos),
      cogs:           r2(cogs),
      opex:           r2(opex),
      utilidad_bruta: r2(utilidad_bruta),
      utilidad_neta:  r2(utilidad_neta),
      margen_bruto:   r2(margen_bruto),
      productos_sin_costo: productosSinCosto,
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
