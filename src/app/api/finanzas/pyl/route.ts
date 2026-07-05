import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

const r2 = (n: number) => Math.round(n * 100) / 100
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// 'new Date("YYYY-MM-DD")' parsea como UTC (spec ECMAScript) — en un servidor
// en UTC-4 eso corre la fecha un día hacia atrás. Se parsea a mano como fecha LOCAL.
function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? null : d
}

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const fromParam   = req.nextUrl.searchParams.get('from')
    const toParam     = req.nextUrl.searchParams.get('to')
    const periodParam = req.nextUrl.searchParams.get('period')

    let from: Date
    let toExclusive: Date

    if (periodParam) {
      const now        = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      toExclusive = new Date(todayStart.getTime() + 86_400_000) // hasta el final de hoy

      if (periodParam === 'hoy') {
        from = todayStart
      } else if (periodParam === '7dias') {
        from = new Date(todayStart.getTime() - 6 * 86_400_000)
      } else if (periodParam === 'mes') {
        from = new Date(now.getFullYear(), now.getMonth(), 1)
      } else if (periodParam === 'anio') {
        from = new Date(now.getFullYear(), 0, 1)
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

      // OPEX excluye categoria='proveedor': una compra de inventario a crédito es
      // COGS al vender (via SaleItem), NO gasto operativo. Contarla aquí duplicaría
      // el costo (GAP-2). Decisión de negocio: Compra ≠ Gasto.
      db.gasto.aggregate({
        where: { fecha: { gte: from, lt: toExclusive }, categoria: { not: 'proveedor' } }, // business_id inyectado por el tenant layer
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
      period: { from: fmtDate(from), to: fmtDate(new Date(toExclusive.getTime() - 86_400_000)) },
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
