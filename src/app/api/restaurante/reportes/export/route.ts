import { NextRequest, NextResponse } from 'next/server'
import { buildReport, reportQuerySchema, resolveRange } from '@/lib/restaurante-reportes'
import { badRequest, handleRestauranteError, requireRestauranteAccess } from '@/lib/restaurante-server'
import type { RestauranteReportDTO } from '@/types/restaurante'

const BOM = '﻿' // Excel abre el CSV en UTF-8 con acentos

/** Una celda CSV: comillas dobles si trae coma, comilla o salto; y se neutraliza una fórmula (=, +, -, @) escrita por un usuario. */
function cell(v: string | number | null): string {
  if (v === null) return ''
  const t = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : /^[=+\-@]/.test(v) ? `'${v}` : v
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

const line = (cols: ReadonlyArray<string | number | null>): string => cols.map(cell).join(',')

/** CSV por secciones. Las propinas van en su PROPIA sección y nunca se suman a las ventas. */
function reportCsv(r: RestauranteReportDTO): string {
  const out: string[] = []
  out.push(line(['Reporte del restaurante', `${r.from} a ${r.to}`]))
  out.push('')
  out.push(line(['VENTAS NETAS (sin propinas)']))
  out.push(line(['Total', 'Ventas', 'Neto USD', 'Neto Bs']))
  out.push(line(['Todas', r.net_sales.sales, r.net_sales.total.usd, r.net_sales.total.bs]))
  out.push('')
  out.push(line(['Ventas por mesonero']))
  out.push(line(['Mesonero', 'Ventas', 'Neto USD', 'Neto Bs']))
  for (const w of r.net_sales.by_waiter) out.push(line([w.name, w.sales, w.net.usd, w.net.bs]))
  out.push('')
  out.push(line(['Ventas por área']))
  out.push(line(['Área', 'Ventas', 'Neto USD', 'Neto Bs']))
  for (const a of r.net_sales.by_area) out.push(line([a.name, a.sales, a.net.usd, a.net.bs]))
  out.push('')
  out.push(line(['PROPINAS (aparte de las ventas)']))
  out.push(line(['Mesonero', 'Propinas', 'Efectivo USD', 'Efectivo Bs', 'Otros métodos USD', 'Otros métodos Bs', 'Total USD', 'Total Bs']))
  for (const t of r.tips.by_waiter) out.push(line([t.name, t.count, t.cash.usd, t.cash.bs, t.other.usd, t.other.bs, t.total.usd, t.total.bs]))
  out.push(line(['Total propinas', '', r.tips.cash.usd, r.tips.cash.bs, r.tips.other.usd, r.tips.other.bs, r.tips.total.usd, r.tips.total.bs]))
  out.push('')
  out.push(line(['ROTACIÓN']))
  out.push(line(['Cuentas cerradas', 'Mesas activas', 'Vueltas por mesa', 'Minutos promedio']))
  out.push(line([r.rotation.closed_accounts, r.rotation.active_tables, r.rotation.turns_per_table, r.rotation.avg_minutes]))
  out.push(line(['Área', 'Cuentas cerradas', 'Minutos promedio']))
  for (const a of r.rotation.by_area) out.push(line([a.area, a.closed, a.avg_minutes]))
  out.push('')
  out.push(line(['TIEMPOS POR ESTACIÓN (minutos)']))
  out.push(line(['Estación', 'Ítems', 'Espera p50', 'Espera p90', 'Preparación p50', 'Preparación p90', 'Total p50', 'Total p90']))
  for (const s of r.stations) out.push(line([s.name, s.items, s.wait_p50, s.wait_p90, s.prep_p50, s.prep_p90, s.total_p50, s.total_p90]))
  return BOM + out.join('\r\n') + '\r\n'
}

// GET /api/restaurante/reportes/export?from=&to=&format=csv (admin). El PDF se arma en el navegador con los mismos datos.
export async function GET(req: NextRequest) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const p = req.nextUrl.searchParams
    const q = reportQuerySchema.safeParse({ from: p.get('from') ?? undefined, to: p.get('to') ?? undefined })
    if (!q.success) return badRequest(q.error)
    const range = resolveRange(q.data.from, q.data.to)
    if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 })
    const report = await buildReport(access.db, access.session.businessId, range.from, range.to, range.start, range.end)
    return new NextResponse(reportCsv(report), {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="restaurante-${range.from}_${range.to}.csv"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    return handleRestauranteError(err, 'GET /api/restaurante/reportes/export')
  }
}
