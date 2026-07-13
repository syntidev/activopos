import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

// Endpoint del dashboard del dueño — auth de sesión normal, NO x-api-key.
// Devuelve el reporte notificado más reciente que el dueño aún no vio.
export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const report = await db.monthlyReport.findFirst({
      where:   { notified_at: { not: null }, seen_at: null },
      orderBy: { notified_at: 'desc' },
      select: {
        id:             true,
        period:         true,
        download_token: true,
        wa_url:         true,
        notified_at:    true,
      },
    })

    return NextResponse.json({ ok: true, notification: report })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
