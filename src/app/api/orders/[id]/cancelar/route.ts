import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

type Context = { params: { id: string } }

// PERMISOS — INTENCIONAL: sin guard de rol. cashier cancela pedidos como admin.
// Atención al cliente, no dato sensible. Sellado en MATRIZ_ROLES_PERMISOS_SELLADA.md (#2).

/* ── POST /api/orders/[id]/cancelar ── */

export async function POST(_req: NextRequest, { params }: Context) {
  const orderId = Number(params.id)
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { db } = await getAuthenticatedTenant()

    const order = await db.order.findFirst({
      where:  { id: orderId }, // business_id inyectado por el tenant layer
      select: { id: true, status: true },
    })

    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    if (['delivered', 'cancelled'].includes(order.status)) {
      return NextResponse.json(
        { error: `No se puede cancelar un pedido en estado "${order.status}"` },
        { status: 422 }
      )
    }

    await db.order.update({
      where: { id: orderId }, // business_id inyectado por el tenant layer
      data:  { status: 'cancelled' },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('cancelar POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
