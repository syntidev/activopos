import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const result = await prisma.notification.updateMany({
    where: { business_id: session.businessId, read_at: null },
    data:  { read_at: new Date(), status: 'read' },
  })

  return NextResponse.json({ ok: true, count: result.count })
}
