export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getGroupMetrics, getProductMetrics } from '@/lib/metrics'
import { metricsError, queryObject, requireMetricsAccess } from '@/lib/metrics-http'
import { exportQuerySchema } from '@/lib/metrics-schemas'
import { checkPlanLimit, planDenied } from '@/lib/plan-guard'
import { businessDateKey } from '@/lib/business-day'
import { monthToDate } from '@/lib/metrics-calc'

// Texto que Excel/Sheets podrían evaluar como fórmula si alguien edita la celda (los nombres los escribe el negocio): se neutraliza.
const safeText = (v: string): string => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v)

// Contrato: .doc/CONTRATO_METRICAS.md §3.5. Mismo helper (xlsx) y mismo plan gate que /api/reports/export-excel.
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const session = await requireMetricsAccess()
    const planGate = await checkPlanLimit('access_export')
    if (!planGate.allowed) return planDenied(planGate.reason)

    const q = exportQuerySchema.parse(queryObject(req.nextUrl))
    const { from, to } = q.from && q.to ? { from: q.from, to: q.to } : monthToDate(businessDateKey())

    let rows: Record<string, string | number>[]
    if (q.view === 'products') {
      const res = await getProductMetrics(session.businessId, { ...q, from, to })
      rows = res.rows.map(r => ({
        'Producto': safeText(r.name), 'Categoría': safeText(r.category ?? ''), 'Subcategoría': safeText(r.subcategory ?? ''), 'Marca': safeText(r.brand ?? ''),
        'Unidades': r.qty ?? '', 'Monto USD': r.usd, 'Monto Bs': r.bs,
        'Unidades (período anterior)': r.prev_qty ?? '', 'Monto USD (período anterior)': r.prev_usd,
      }))
    } else {
      const res = await getGroupMetrics(session.businessId, q.by ?? 'category', { from, to, cashier_id: q.cashier_id })
      rows = res.rows.map(r => ({
        'Grupo': safeText(r.label), 'Productos': r.products_count,
        'Unidades': r.qty ?? '', 'Monto USD': r.usd, 'Monto Bs': r.bs,
        'Unidades (período anterior)': r.prev_qty ?? '', 'Monto USD (período anterior)': r.prev_usd,
      }))
    }

    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Sin ventas': `${from} a ${to}` }])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Métricas')
    const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]

    return new Response(new Uint8Array(raw), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="metricas-${q.view}-${from}_a_${to}.xlsx"`,
      },
    })
  } catch (e) {
    return metricsError(e, 'export')
  }
}
