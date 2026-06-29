import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

export async function GET() {
  try {
    const { db } = await getAuthenticatedTenant()

    const methods = await db.paymentMethod.findMany({
      where: { is_active: true }, // business_id inyectado por el tenant layer
      orderBy: { sort_order: 'asc' },
      select: { id: true, name: true, type: true, sort_order: true, is_active: true },
    })

    return NextResponse.json({ ok: true, methods })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
