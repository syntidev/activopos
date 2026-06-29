import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

export async function GET() {
  try {
    const { db } = await getAuthenticatedTenant()

    const pendingOrders = await db.order.count({
      where: { status: 'received' }, // business_id inyectado por el tenant layer
    })

    return NextResponse.json({ ok: true, pending_orders: pendingOrders })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
