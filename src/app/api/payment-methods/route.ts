import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const methods = await prisma.paymentMethod.findMany({
    where: { business_id: session.businessId, is_active: true },
    orderBy: { sort_order: 'asc' },
    select: { id: true, name: true, type: true, sort_order: true, is_active: true },
  })

  return NextResponse.json({ ok: true, methods })
}
