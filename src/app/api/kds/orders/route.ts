import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

/* ── GET /api/kds/orders — active kitchen orders for display ── */

export async function GET() {
  try {
    const { db } = await getAuthenticatedTenant()

    const orders = await db.order.findMany({
      where: {
        // business_id inyectado por el tenant layer
        status: { in: ['received', 'preparing', 'ready'] },
        // Las cuentas de mesa (origin = 'table') nacen en 'received' pero no son pedidos de cocina de este KDS: las comandas de
        // mesa se ven por estación en /api/restaurante/kds. Esta ruta NO filtra por send_to_kds, así que se excluyen por origen.
        origin: { not: 'table' },
      },
      include: {
        items: {
          select: {
            id:                true,
            product_name:      true,
            quantity:          true,
            variant_label:     true,
            price_per_unit_usd: true,
            subtotal_usd:      true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    })

    return NextResponse.json({
      ok: true,
      orders: orders.map(o => ({
        id:            o.id,
        order_number:  o.order_number,
        status:        o.status,
        client_name:   o.client_name,
        notes:         o.notes,
        estimated_time: o.estimated_time,
        created_at:    o.created_at,
        items: o.items.map(i => ({
          id:                i.id,
          product_name:      i.product_name,
          quantity:          Number(i.quantity),
          variant_label:     i.variant_label,
        })),
      })),
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
