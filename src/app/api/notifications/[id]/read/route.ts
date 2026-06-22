import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Context = { params: { id: string } }

export async function PATCH(_req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const notification = await prisma.notification.findFirst({
    where: { id, business_id: session.businessId },
  })
  if (!notification) return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 })
  if (notification.read_at) return NextResponse.json({ ok: true, already_read: true })

  const updated = await prisma.notification.update({
    where: { id },
    data:  { read_at: new Date(), status: 'read' },
  })

  return NextResponse.json({ ok: true, notification: updated })
}
