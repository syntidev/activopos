import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  await prisma.business.update({
    where: { id: session.businessId },
    data:  { notifications_last_read: new Date() },
  })

  return NextResponse.json({ ok: true })
}

export const PATCH = POST
