import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const sale = await prisma.sale.findFirst({
    where: { id, business_id: session.businessId },
    include: {
      items: {
        select: {
          id:                 true,
          product_id:         true,
          product_name:       true,
          quantity:           true,
          price_per_unit_usd: true,
          subtotal_usd:       true,
          subtotal_bs:        true,
          discount_usd:       true,
          sale_mode:          true,
          unit_label:         true,
          variant_id:         true,
        },
        orderBy: { id: 'asc' },
      },
      payments: {
        include: { payment_method: { select: { id: true, name: true, type: true } } },
      },
      client:  { select: { id: true, name: true, phone: true } },
      cashier: { select: { id: true, name: true } },
    },
  })

  if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })

  return NextResponse.json({ ok: true, sale })
}
