import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { checkPlanLimit, planDenied } from '@/lib/plan-guard'
import { parsePeriodFromParams, MONTH_NAMES } from '@/lib/finanzas'

// Prevent CSV/XLSX formula injection — prefix dangerous leading chars with a literal apostrophe
function safe(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
}

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    const planGate = await checkPlanLimit('access_export')
    if (!planGate.allowed) return planDenied(planGate.reason)

    const { year, month } = parsePeriodFromParams(req.nextUrl.searchParams)
    const from = new Date(year, month - 1, 1)
    const to   = new Date(year, month, 1)

    const [ventas, gastos, cxcSales] = await Promise.all([
      db.sale.findMany({
        where: { status: 'paid', sold_at: { gte: from, lt: to } }, // business_id inyectado
        include: { payments: { include: { payment_method: true } } },
        orderBy: { sold_at: 'asc' },
      }),
      db.gasto.findMany({
        where: { fecha: { gte: from, lt: to } }, // business_id inyectado
        orderBy: { fecha: 'asc' },
      }),
      db.sale.findMany({
        where: {
          // business_id inyectado por el tenant layer
          status: 'credit',
          created_at: { gte: from, lt: to },
        },
        orderBy: { created_at: 'asc' },
      }),
    ])

    const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`
    const safeFilename = `finanzas-${year}-${String(month).padStart(2, '0')}.xlsx`

    // Hoja 1 — Ventas
    const wsVentas = XLSX.utils.json_to_sheet(
      ventas.length > 0
        ? ventas.map(s => ({
            'Fecha':       s.sold_at ? s.sold_at.toISOString().slice(0, 10) : '',
            '# Ticket':    safe(s.ticket_number),
            'Cliente':     safe(s.client_name ?? ''),
            'Total USD':   Number(s.total_usd),
            'Total Bs':    Number(s.total_bs),
            'Tasa BCV':    Number(s.rate_used),
            'Método':      safe(s.payments.map(p => p.payment_method?.name ?? '').join(', ')),
          }))
        : [{ 'Sin ventas': periodLabel }]
    )

    // Hoja 2 — Gastos
    const wsGastos = XLSX.utils.json_to_sheet(
      gastos.length > 0
        ? gastos.map(g => ({
            'Fecha':    g.fecha.toISOString().slice(0, 10),
            'Concepto': safe(g.concepto),
            'Categoría': safe(g.categoria),
            'Monto USD': Number(g.monto_usd),
          }))
        : [{ 'Sin gastos': periodLabel }]
    )

    // Hoja 3 — Cuentas por Cobrar (ventas a crédito del período)
    const wsCxC = XLSX.utils.json_to_sheet(
      cxcSales.length > 0
        ? cxcSales.map(s => ({
            'Fecha':     s.sold_at ? s.sold_at.toISOString().slice(0, 10) : '',
            '# Ticket':  safe(s.ticket_number),
            'Cliente':   safe(s.client_name ?? ''),
            'Total USD': Number(s.total_usd),
            'Total Bs':  Number(s.total_bs),
          }))
        : [{ 'Sin CxC': periodLabel }]
    )

    // Hoja 4 — Resumen
    const totalVentas  = ventas.reduce((s, v) => s + Number(v.total_usd), 0)
    const totalGastos  = gastos.reduce((s, g) => s + Number(g.monto_usd), 0)
    const totalCxC     = cxcSales.reduce((s, v) => s + Number(v.total_usd), 0)
    const utilidadBruta = totalVentas - totalGastos

    const wsResumen = XLSX.utils.json_to_sheet([
      { 'Concepto': 'Período',         'Valor USD': periodLabel },
      { 'Concepto': 'Total Ventas',    'Valor USD': totalVentas.toFixed(2) },
      { 'Concepto': 'Total Gastos',    'Valor USD': totalGastos.toFixed(2) },
      { 'Concepto': 'Utilidad Bruta',  'Valor USD': utilidadBruta.toFixed(2) },
      { 'Concepto': 'CxC Pendiente',   'Valor USD': totalCxC.toFixed(2) },
    ])

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')
    XLSX.utils.book_append_sheet(wb, wsVentas,  'Ventas')
    XLSX.utils.book_append_sheet(wb, wsGastos,  'Gastos')
    XLSX.utils.book_append_sheet(wb, wsCxC,     'CxC')

    const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
    const buffer = new Uint8Array(raw)

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
      },
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
