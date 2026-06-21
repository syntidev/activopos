import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const dateParam = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)

  if (!dateSchema.safeParse(dateParam).success) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
  }

  const [year, month, day] = dateParam.split('-').map(Number)
  const dayStart = new Date(year, month - 1, day)
  const dayEnd   = new Date(dayStart.getTime() + 86_400_000)

  const sales = await prisma.sale.findMany({
    where: {
      business_id: session.businessId,
      status: 'paid',
      sold_at: { gte: dayStart, lt: dayEnd },
    },
    include: {
      items: true,
      payments: {
        include: { payment_method: true },
      },
    },
    orderBy: { sold_at: 'asc' },
  })

  const rows = sales.flatMap(sale => {
    const metodos = sale.payments
      .map(p => p.payment_method?.name ?? p.payment_method_id.toString())
      .join(', ')

    return sale.items.map(item => ({
      'Fecha':       dateParam,
      '# Ticket':    sale.ticket_number,
      'Producto':    item.product_name,
      'Cantidad':    Number(item.quantity),
      'Precio USD':  Number(item.price_per_unit_usd),
      'Total USD':   Number(item.subtotal_usd),
      'Total Bs':    Number(item.subtotal_bs),
      'Método':      metodos,
      'Cliente':     sale.client_name ?? '',
      'Estado':      sale.status,
    }))
  })

  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Sin ventas': dateParam }])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas')

  const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
  const buffer = new Uint8Array(raw)

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reporte-${dateParam}.xlsx"`,
    },
  })
}
