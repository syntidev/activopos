import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const notifications = await prisma.notification.findMany({
    where:   { business_id: session.businessId },
    orderBy: { created_at: 'desc' },
    take:    20,
  })

  return NextResponse.json({ ok: true, notifications })
}
