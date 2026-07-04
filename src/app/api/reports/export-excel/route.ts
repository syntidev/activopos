import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const rangeSchema = z.object({
  from: dateSchema,
  to:   dateSchema,
}).superRefine((data, ctx) => {
  if (new Date(data.from) > new Date(data.to)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '"from" debe ser anterior o igual a "to"', path: ['from'] })
  }
  const diffDays = (new Date(data.to).getTime() - new Date(data.from).getTime()) / 86_400_000
  if (diffDays > 90) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rango máximo 90 días', path: ['to'] })
  }
})

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const sp        = req.nextUrl.searchParams
    const fromParam = sp.get('from')
    const toParam   = sp.get('to')
    const isRange   = fromParam !== null || toParam !== null

    let rangeStart: Date
    let rangeEnd: Date
    let filenamePart: string

    if (isRange) {
      const parsed = rangeSchema.safeParse({ from: fromParam, to: toParam })
      if (!parsed.success) {
        return NextResponse.json({ error: 'Parámetros inválidos', issues: parsed.error.issues }, { status: 400 })
      }
      const [fy, fm, fd] = parsed.data.from.split('-').map(Number)
      const [ty, tm, td] = parsed.data.to.split('-').map(Number)
      rangeStart   = new Date(fy, fm - 1, fd)
      rangeEnd     = new Date(new Date(ty, tm - 1, td).getTime() + 86_400_000)
      filenamePart = `${parsed.data.from}_a_${parsed.data.to}`
    } else {
      const dateParam = sp.get('date') ?? new Date().toISOString().slice(0, 10)
      if (!dateSchema.safeParse(dateParam).success) {
        return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
      }
      const [year, month, day] = dateParam.split('-').map(Number)
      rangeStart   = new Date(year, month - 1, day)
      rangeEnd     = new Date(rangeStart.getTime() + 86_400_000)
      filenamePart = dateParam
    }

    const sales = await db.sale.findMany({
      where: {
        // business_id inyectado por el tenant layer
        status: 'paid',
        sold_at: { gte: rangeStart, lt: rangeEnd },
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
        'Fecha':       sale.sold_at?.toISOString().slice(0, 10) ?? filenamePart,
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

    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Sin ventas': filenamePart }])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas')

    const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
    const buffer = new Uint8Array(raw)

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reporte-${filenamePart}.xlsx"`,
      },
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
