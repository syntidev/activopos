import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { checkPlanLimit } from '@/lib/plan-guard'

const dateStr   = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido')
const rangeSchema = z.object({ from: dateStr, to: dateStr }).superRefine((data, ctx) => {
  const f = new Date(data.from)
  const t = new Date(data.to)
  if (isNaN(f.getTime()) || isNaN(t.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fecha inválida' })
    return
  }
  if (f > t) ctx.addIssue({ code: z.ZodIssueCode.custom, message: '"from" debe ser anterior o igual a "to"' })
  if ((t.getTime() - f.getTime()) / 86_400_000 > 365) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rango máximo 365 días' })
  }
})

// Prevent CSV/XLSX formula injection — prefix dangerous leading chars with a literal apostrophe
function safe(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
}

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    const planGate = await checkPlanLimit('access_export')
    if (!planGate.allowed) return NextResponse.json({ error: planGate.reason }, { status: 403 })

    const sp     = req.nextUrl.searchParams
    const parsed = rangeSchema.safeParse({ from: sp.get('from'), to: sp.get('to') })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parámetros inválidos', issues: parsed.error.issues }, { status: 400 })
    }

    const { from: fromStr, to: toStr } = parsed.data
    const from = new Date(`${fromStr}T00:00:00`)
    const to   = new Date(`${toStr}T23:59:59.999`)

    const [ventas, gastos] = await Promise.all([
      db.sale.findMany({
        where: { status: 'paid', sold_at: { gte: from, lte: to } }, // business_id inyectado
        include: { payments: { include: { payment_method: { select: { name: true } } } } },
        orderBy: { sold_at: 'asc' },
      }),
      db.gasto.findMany({
        where: { fecha: { gte: from, lte: to } }, // business_id inyectado
        orderBy: { fecha: 'asc' },
      }),
    ])

    const totalVentas = ventas.reduce((s, v) => s + Number(v.total_usd), 0)
    const totalGastos = gastos.reduce((s, g) => s + Number(g.monto_usd), 0)
    const utilidadNeta = totalVentas - totalGastos
    const margen = totalVentas > 0 ? (utilidadNeta / totalVentas) * 100 : 0

    // Hoja 1 — Ventas
    const wsVentas = XLSX.utils.json_to_sheet(
      ventas.length > 0
        ? ventas.map(s => ({
            'Fecha':      s.sold_at ? s.sold_at.toISOString().slice(0, 10) : '',
            '# Ticket':   safe(s.ticket_number),
            'Cliente':    safe(s.client_name ?? ''),
            'Total USD':  Number(s.total_usd),
            'Total Bs':   Number(s.total_bs),
            'Tasa BCV':   Number(s.rate_used),
            'Método':     safe(s.payments.map(p => p.payment_method?.name ?? '').join(', ')),
          }))
        : [{ 'Sin ventas': `${fromStr} → ${toStr}` }]
    )

    // Hoja 2 — Gastos
    const wsGastos = XLSX.utils.json_to_sheet(
      gastos.length > 0
        ? gastos.map(g => ({
            'Fecha':       g.fecha.toISOString().slice(0, 10),
            'Categoría':   safe(g.categoria),
            'Descripción': safe(g.concepto),
            'Monto USD':   Number(g.monto_usd),
          }))
        : [{ 'Sin gastos': `${fromStr} → ${toStr}` }]
    )

    // Hoja 3 — Resumen
    const wsResumen = XLSX.utils.json_to_sheet([
      { 'Concepto': 'Período',         'Valor USD': `${fromStr} → ${toStr}` },
      { 'Concepto': 'Ingresos',        'Valor USD': totalVentas.toFixed(2) },
      { 'Concepto': 'Gastos',          'Valor USD': totalGastos.toFixed(2) },
      { 'Concepto': 'Utilidad Neta',   'Valor USD': utilidadNeta.toFixed(2) },
      { 'Concepto': 'Margen %',        'Valor USD': `${margen.toFixed(1)}%` },
    ])

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')
    XLSX.utils.book_append_sheet(wb, wsVentas,  'Ventas')
    XLSX.utils.book_append_sheet(wb, wsGastos,  'Gastos')

    const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
    const buf = new Uint8Array(raw)

    return new NextResponse(buf.buffer as ArrayBuffer, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="finanzas-${fromStr}-${toStr}.xlsx"`,
      },
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
