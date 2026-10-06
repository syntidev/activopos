import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { netCogs, netSales } from '@/lib/sales-returns'
import { checkPlanLimit, planDenied } from '@/lib/plan-guard'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { MONTH_NAMES, parsePeriodFromParams } from '@/lib/finanzas'

type InvRow = {
  valor_costo: string | null
  valor_venta: string | null
  productos_count: string | number
  productos_sin_costo: string | number
}

function generateInsight(
  ventas: number,
  margenBruto: number,
  margenNeto: number,
  utilidadNeta: number,
  cxcCount: number,
  cxcUsd: number,
): string {
  if (ventas === 0) return 'Sin ventas registradas para este período.'
  if (utilidadNeta < 0) {
    return `Pérdida neta de $${Math.abs(utilidadNeta).toFixed(2)}. Los gastos operativos superan el margen bruto.`
  }
  const parts: string[] = []
  if (margenBruto >= 40) {
    parts.push(`Margen bruto sólido de ${margenBruto.toFixed(1)}%.`)
  } else if (margenBruto < 20) {
    parts.push(`Margen bruto bajo (${margenBruto.toFixed(1)}%). Revisar precios o costos.`)
  }
  if (cxcCount > 0) {
    parts.push(`${cxcCount} venta${cxcCount > 1 ? 's' : ''} a crédito por cobrar ($${cxcUsd.toFixed(2)}).`)
  }
  return parts.length > 0
    ? parts.join(' ')
    : `Utilidad neta de $${utilidadNeta.toFixed(2)} con margen de ${margenNeto.toFixed(1)}%.`
}

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    const planGate = await checkPlanLimit('access_finanzas')
    if (!planGate.allowed) return planDenied(planGate.reason)

    const { year, month } = parsePeriodFromParams(req.nextUrl.searchParams)
  const from     = new Date(year, month - 1, 1)
  const to       = new Date(year, month, 1)
  const bid      = session.businessId
  const now      = new Date()
  const vencer7  = new Date(now.getTime() + 7 * 86_400_000)

  const [
    ventas,
    abonosAgg,
    cogs,
    costeadosRow,
    gastosOpAgg,
    gastosPagadosAgg,
    cxcAgg,
    cxcVencidasCount,
    cxcPorVencerCount,
    cxpAgg,
    cxpVencidasCount,
    inventarioRow,
  ] = await Promise.all([
    // Ingreso NETO del período -- fuente única (src/lib/sales-returns.ts).
    // Antes sumaba el bruto de las ventas con devolución parcial y dejaba la
    // porción devuelta solo en COGS/inventario: el ingreso quedaba inflado.
    netSales(bid, from, to),

    // Abonos recibidos en el período — SaleAbono no tiene business_id,
    // se aísla por la relación sale.business_id
    db.saleAbono.aggregate({
      where: {
        sale:       { business_id: bid },
        created_at: { gte: from, lt: to },
      },
      _sum: { amount_usd: true },
    }),

    // COGS: qty * costo capturado EN LA VENTA (si.cost_per_unit_usd), no el costo
    // actual del producto — el costo histórico de la venta no debe moverse si el
    // producto se recotiza después. Fuente única de COGS (GAP-2 / decisión Compra≠Gasto).
    // ingresos_costeados/productos_sin_costo: productos con costo desconocido
    // (cost_unknown) quedan fuera del % de margen — su ingreso no entra al
    // denominador para no inflar el margen con utilidad ficticia de costo $0.
    // COGS neto (revierte con el snapshot de ReturnItem) -- fuente única.
    netCogs(bid, from, to),

    // ingresos_costeados: ingreso de las líneas CON costo conocido, neto de lo
    // devuelto de esas mismas líneas. Es el denominador del % de margen: el
    // ingreso de productos sin costo queda fuera para no inflar el margen con
    // utilidad ficticia de costo 0.
    prisma.$queryRaw<{ ingresos_costeados: string | null }[]>`
      SELECT
        (SELECT IFNULL(SUM(si.subtotal_usd), 0)
           FROM sale_items si
           JOIN sales s ON s.id = si.sale_id
          WHERE s.business_id = ${bid}
            AND s.status IN ('paid','partial_return')
            AND si.cost_per_unit_usd IS NOT NULL
            AND s.sold_at >= ${from} AND s.sold_at < ${to})
        -
        (SELECT IFNULL(SUM(ri.total_usd), 0)
           FROM return_items ri
           JOIN returns r ON r.id = ri.return_id
           JOIN sales s   ON s.id = r.sale_id
           JOIN sale_items si2 ON si2.sale_id = s.id AND si2.product_id = ri.product_id
          WHERE r.business_id = ${bid}
            AND r.status = 'approved'
            AND s.status IN ('paid','partial_return')
            AND si2.cost_per_unit_usd IS NOT NULL
            AND s.sold_at >= ${from} AND s.sold_at < ${to})
        AS ingresos_costeados`,

    // Gastos operativos incurridos en el período (pagados o no), EXCLUYENDO
    // categoria='proveedor' — esas compras son COGS al vender, no OPEX (GAP-2).
    db.gasto.aggregate({
      where: { fecha: { gte: from, lt: to }, categoria: { not: 'proveedor' } }, // business_id inyectado
      _sum:  { monto_usd: true },
    }),

    // Cuentas pagadas en el período (gastos con paid_at en el período)
    db.gasto.aggregate({
      where: {
        // business_id inyectado por el tenant layer
        is_paid:     true,
        paid_at:     { gte: from, lt: to },
      },
      _sum: { monto_usd: true },
    }),

    // CxC activas (ventas pendientes de cobro)
    db.sale.aggregate({
      where:  { status: 'credit' }, // business_id inyectado
      _sum:   { total_usd: true },
      _count: { id: true },
    }),

    // CxC vencidas: ventas pendientes con due_date pasado
    db.sale.count({
      where: { status: 'credit', due_date: { lt: now } }, // business_id inyectado
    }),

    // CxC por vencer en los próximos 7 días
    db.sale.count({
      where: { status: 'credit', due_date: { gte: now, lte: vencer7 } }, // business_id inyectado
    }),

    // CxP activas (gastos sin pagar)
    db.gasto.aggregate({
      where:  { is_paid: false }, // business_id inyectado
      _sum:   { monto_usd: true },
      _count: { id: true },
    }),

    // CxP vencidas: gastos sin pagar con fecha pasada (fecha < hoy)
    db.gasto.count({
      where: { is_paid: false, due_date: { lt: now, not: null } }, // business_id inyectado
    }),

    // Inventario valorizado al costo y a precio de venta
    prisma.$queryRaw<InvRow[]>`
      SELECT
        SUM(COALESCE(p.cost_per_unit_usd, 0) *
          GREATEST(0, COALESCE(ie_t.qty_in, 0) - COALESCE(si_t.qty_out, 0))
        ) AS valor_costo,
        SUM(COALESCE(COALESCE(p.price_per_unit_usd, p.price_per_kg_usd), 0) *
          GREATEST(0, COALESCE(ie_t.qty_in, 0) - COALESCE(si_t.qty_out, 0))
        ) AS valor_venta,
        COUNT(*) AS productos_count,
        COUNT(CASE WHEN p.cost_unknown = true THEN 1 END) AS productos_sin_costo
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(quantity) AS qty_in
        FROM inventory_entries WHERE business_id = ${bid}
        GROUP BY product_id
      ) ie_t ON ie_t.product_id = p.id
      -- qty_out incluye partial_return: antes se filtraba solo 'paid', así que
      -- las unidades de una venta con devolución parcial NUNCA se descontaban
      -- del inventario y encima la devuelta reingresaba por inventory_entries
      -- (quedaba sobrevalorado en las unidades vendidas). Ahora la venta sale
      -- una vez y el reingreso de la unidad devuelta lo aporta su
      -- inventory_entry 'return', una sola vez.
      LEFT JOIN (
        SELECT si.product_id, SUM(si.quantity) AS qty_out
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.business_id = ${bid} AND s.status IN ('paid','partial_return')
        GROUP BY si.product_id
      ) si_t ON si_t.product_id = p.id
      WHERE p.business_id = ${bid}
        AND p.active = true
        AND p.product_type IN ('simple', 'combo', 'fabricable')`,

  ])

  const { rate }      = await getActiveRate(bid)
  const r2            = (x: number) => Math.round(x * 100) / 100

  const ventasUsd     = ventas.net.usd
  const ventasBs      = ventas.net.bs
  const abonosUsd     = Number(abonosAgg._sum.amount_usd  ?? 0)
  const costoVentas       = cogs.netUsd
  const ingresosCosteados = parseFloat(String(costeadosRow[0]?.ingresos_costeados ?? '0')) || 0
  const productosSinCosto = cogs.productsWithoutCostCount
  const gastosOpUsd   = Number(gastosOpAgg._sum.monto_usd        ?? 0)
  const cuentasPagUsd = Number(gastosPagadosAgg._sum.monto_usd   ?? 0)

  const utilidadBruta = r2(ventasUsd - costoVentas)
  const utilidadNeta  = r2(utilidadBruta - gastosOpUsd)
  // margenBruto/margenNeto: % calculado SOLO sobre ventas con costo conocido —
  // productos con cost_unknown quedan fuera del ratio (ver productosSinCosto),
  // no mezclados como utilidad ficticia de costo $0.
  const margenBruto = ingresosCosteados > 0
    ? r2(((ingresosCosteados - costoVentas) / ingresosCosteados) * 100)
    : 0
  const margenNeto  = ingresosCosteados > 0
    ? r2(((ingresosCosteados - costoVentas - gastosOpUsd) / ingresosCosteados) * 100)
    : 0

  const cxcUsd        = Number(cxcAgg._sum.total_usd ?? 0)
  const cxpUsd        = Number(cxpAgg._sum.monto_usd  ?? 0)

  const invCosto      = parseFloat(String(inventarioRow[0]?.valor_costo ?? '0')) || 0
  const invVenta      = parseFloat(String(inventarioRow[0]?.valor_venta ?? '0')) || 0
  const invCount      = parseInt(String(inventarioRow[0]?.productos_count ?? '0'), 10)
  const invSinCosto   = parseInt(String(inventarioRow[0]?.productos_sin_costo ?? '0'), 10)

  const periodLabel   = `${MONTH_NAMES[month - 1]} ${year}`

  return NextResponse.json({
    ok: true,

    // ── Nuevo shape (spec Sprint 12) ──
    period: { month, year, label: periodLabel },
    rate_bcv: rate,

    ingresos: {
      ventas_usd:           r2(ventasUsd),
      ventas_bs:            r2(ventasBs),
      abonos_cobrados_usd:  r2(abonosUsd),
      total_usd:            r2(ventasUsd),
    },

    egresos: {
      gastos_operativos_usd: r2(gastosOpUsd),
      cuentas_pagadas_usd:   r2(cuentasPagUsd),
      total_usd:             r2(gastosOpUsd + cuentasPagUsd),
    },

    resultado: {
      costo_ventas_usd:   r2(costoVentas),
      utilidad_bruta_usd: utilidadBruta,
      margen_bruto_pct:   margenBruto,
      utilidad_neta_usd:  utilidadNeta,
      margen_neto_pct:    margenNeto,
      productos_sin_costo: productosSinCosto,
    },

    cxc: {
      total_pendiente_usd: r2(cxcUsd),
      count:               cxcAgg._count.id,
      vencidas:            cxcVencidasCount,
      por_vencer:          cxcPorVencerCount,
    },

    cxp: {
      total_pendiente_usd: r2(cxpUsd),
      count:               cxpAgg._count.id,
      vencidas:            cxpVencidasCount,
    },

    inventario: {
      valor_costo_usd:       r2(invCosto),
      valor_venta_usd:       r2(invVenta),
      margen_potencial_usd:  r2(invVenta - invCosto),
      productos_count:       invCount,
      productos_sin_costo:   invSinCosto,
    },

    // ── Backward-compat (shape anterior) ──
    month: `${year}-${String(month).padStart(2, '0')}`,
    rate,
    ingresos_totales:  { usd: r2(ventasUsd), bs: r2(ventasBs) },
    gastos_totales:    { usd: r2(gastosOpUsd), bs: r2(gastosOpUsd * rate) },
    por_cobrar:        { usd: r2(cxcUsd), bs: r2(cxcUsd * rate), count: cxcAgg._count.id },
    por_pagar:         { usd: r2(cxpUsd), bs: r2(cxpUsd * rate), count: cxpAgg._count.id },
    estado_resultados: {
      ventas_netas:         r2(ventasUsd),
      ventas_netas_bs:      r2(ventasBs),
      costo_ventas:         r2(costoVentas),
      costo_ventas_bs:      r2(costoVentas   * rate),
      utilidad_bruta:       utilidadBruta,
      utilidad_bruta_bs:    r2(utilidadBruta * rate),
      margen_bruto_pct:     margenBruto,
      gastos_operativos:    r2(gastosOpUsd),
      gastos_operativos_bs: r2(gastosOpUsd   * rate),
      utilidad_neta:        utilidadNeta,
      utilidad_neta_bs:     r2(utilidadNeta  * rate),
      margen_neto_pct:      margenNeto,
    },
    insight: generateInsight(ventasUsd, margenBruto, margenNeto, utilidadNeta, cxcAgg._count.id, cxcUsd),
  })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
