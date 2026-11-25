import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { guardEntitlement } from '@/lib/entitlements'

/* ── GET /api/kds/orders — active kitchen orders for display ── */

export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()
    // Enforcement al USAR (no solo al activar): derecho del plan/add-on + suscripción vigente + módulo encendido por el tenant.
    const denied = await guardEntitlement(session.businessId, 'kds')
    if (denied) return denied

    const orders = await db.order.findMany({
      where: {
        // business_id inyectado por el tenant layer
        status: { in: ['received', 'preparing', 'ready'] },
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
