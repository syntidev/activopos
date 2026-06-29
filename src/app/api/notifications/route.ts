import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

export async function GET() {
  try {
    const { db } = await getAuthenticatedTenant()

    const notifications = await db.notification.findMany({
      // business_id inyectado por el tenant layer
      orderBy: { created_at: 'desc' },
      take:    20,
    })

    return NextResponse.json({ ok: true, notifications })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
