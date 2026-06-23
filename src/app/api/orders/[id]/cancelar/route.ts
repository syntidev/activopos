import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Context = { params: { id: string } }

/* ── POST /api/orders/[id]/cancelar ── */

export async function POST(_req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orderId = Number(params.id)
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const order = await prisma.order.findFirst({
      where:  { id: orderId, business_id: session.businessId },
      select: { id: true, status: true },
    })

    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    if (['delivered', 'cancelled'].includes(order.status)) {
      return NextResponse.json(
        { error: `No se puede cancelar un pedido en estado "${order.status}"` },
        { status: 422 }
      )
    }

    await prisma.order.update({
      where: { id: orderId },
      data:  { status: 'cancelled' },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('cancelar POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
