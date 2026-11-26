import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { guardEntitlement } from '@/lib/entitlements'
import { stationIdsOfUser } from '@/lib/user-stations'

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
            product_id:        true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    })

    // Restaurante (R3): un cocinero solo ve lo que se prepara en SUS estaciones. Un ítem ruteado a otra estación (por producto o por
    // categoría) no se le muestra; lo que no está ruteado a ninguna estación sigue como siempre.
    const mine = session.role === 'kitchen' ? new Set(await stationIdsOfUser(db, session.businessId, session.userId)) : null
    let visible = orders
    if (mine !== null) {
      const products = await db.product.findMany({
        where:  { id: { in: Array.from(new Set(orders.flatMap(o => o.items.map(i => i.product_id)))) } },
        select: { id: true, station_id: true, category: { select: { station_id: true } } },
      })
      const stationOf = new Map(products.map(p => [p.id, p.station_id ?? p.category?.station_id ?? null]))
      visible = orders
        .map(o => ({ ...o, items: o.items.filter(i => { const st = stationOf.get(i.product_id) ?? null; return st === null || mine.has(st) }) }))
        .filter(o => o.items.length > 0)
    }

    return NextResponse.json({
      ok: true,
      orders: visible.map(o => ({
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
