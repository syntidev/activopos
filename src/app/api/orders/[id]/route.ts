import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

// PERMISOS — INTENCIONAL: sin guard de rol. cashier edita/cancela pedidos como admin.
// Atención al cliente, no dato sensible. Sellado en MATRIZ_ROLES_PERMISOS_SELLADA.md (#2).

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
  try {
    const { db } = await getAuthenticatedTenant()

    const id = Number(params.id)
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const order = await db.order.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
      include: {
        items: true,
        client: { select: { id: true, name: true, phone: true } },
      },
    })

    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    return NextResponse.json({ ok: true, order })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
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
