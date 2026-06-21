import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parsePeriodFromParams, MONTH_NAMES } from '@/lib/finanzas'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const { year, month } = parsePeriodFromParams(req.nextUrl.searchParams)
  const from = new Date(year, month - 1, 1)
  const to   = new Date(year, month, 1)
  const bid  = session.businessId

  const [ventas, gastos, cxcSales] = await Promise.all([
    prisma.sale.findMany({
      where: { business_id: bid, status: 'paid', sold_at: { gte: from, lt: to } },
      include: { payments: { include: { payment_method: true } } },
      orderBy: { sold_at: 'asc' },
    }),
    prisma.gasto.findMany({
      where: { business_id: bid, fecha: { gte: from, lt: to } },
      orderBy: { fecha: 'asc' },
    }),
    prisma.sale.findMany({
      where: {
        business_id: bid,
        status: 'pending',
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
          '# Ticket':    s.ticket_number,
          'Cliente':     s.client_name ?? '',
          'Total USD':   Number(s.total_usd),
          'Total Bs':    Number(s.total_bs),
          'Tasa BCV':    Number(s.rate_used),
          'Método':      s.payments.map(p => p.payment_method?.name ?? '').join(', '),
        }))
      : [{ 'Sin ventas': periodLabel }]
  )

  // Hoja 2 — Gastos
  const wsGastos = XLSX.utils.json_to_sheet(
    gastos.length > 0
      ? gastos.map(g => ({
          'Fecha':    g.fecha.toISOString().slice(0, 10),
          'Concepto': g.concepto,
          'Categoría': g.categoria,
          'Monto USD': Number(g.monto_usd),
        }))
      : [{ 'Sin gastos': periodLabel }]
  )

  // Hoja 3 — Cuentas por Cobrar (ventas a crédito del período)
  const wsCxC = XLSX.utils.json_to_sheet(
    cxcSales.length > 0
      ? cxcSales.map(s => ({
          'Fecha':     s.sold_at ? s.sold_at.toISOString().slice(0, 10) : '',
          '# Ticket':  s.ticket_number,
          'Cliente':   s.client_name ?? '',
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
}
