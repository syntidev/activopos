import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

type Context = { params: { id: string } }

export async function PATCH(_req: NextRequest, { params }: Context) {
  try {
    const { db } = await getAuthenticatedTenant()

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const notification = await db.notification.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!notification) return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 })
    if (notification.read_at) return NextResponse.json({ ok: true, already_read: true })

    const updated = await db.notification.update({
      where: { id }, // business_id inyectado por el tenant layer
      data:  { read_at: new Date(), status: 'read' },
    })

    return NextResponse.json({ ok: true, notification: updated })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
