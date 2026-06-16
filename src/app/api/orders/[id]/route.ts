import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_TRANSITIONS: Record<string, string[]> = {
  received:   ['preparing', 'cancelled'],
  preparing:  ['ready', 'cancelled'],
  ready:      ['dispatched', 'cancelled'],
  dispatched: ['delivered', 'cancelled'],
  delivered:  [],
  cancelled:  [],
}

const patchSchema = z.object({
  status: z.enum(['received', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled']),
})

/* ── GET /api/orders/[id] ── */

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const order = await prisma.order.findFirst({
    where: { id, business_id: session.businessId },
    include: {
      items: true,
      client: { select: { id: true, name: true, phone: true } },
    },
  })

  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true, order })
}

/* ── PATCH /api/orders/[id] ── */

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await req.json()
    const { status } = patchSchema.parse(body)

    const order = await prisma.order.findFirst({
      where: { id, business_id: session.businessId },
      select: { id: true, status: true },
    })

    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    const allowed = VALID_TRANSITIONS[order.status] ?? []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `No se puede pasar de "${order.status}" a "${status}"` },
        { status: 422 }
      )
    }

    const updated = await prisma.order.update({
      where: { id },
      data:  { status },
      include: { items: true },
    })

    return NextResponse.json({ ok: true, order: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('orders PATCH error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
