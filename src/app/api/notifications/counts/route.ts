import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const pendingOrders = await prisma.order.count({
    where: { business_id: session.businessId, status: 'received' },
  })

  return NextResponse.json({ ok: true, pending_orders: pendingOrders })
}
