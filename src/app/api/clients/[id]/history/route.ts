import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getClientHistory } from '@/lib/clients'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const clientId = parseInt(params.id)
  if (isNaN(clientId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const [history, paymentMethods] = await Promise.all([
    getClientHistory(clientId, session.businessId),
    prisma.paymentMethod.findMany({
      where: { business_id: session.businessId, is_active: true },
      orderBy: { sort_order: 'asc' },
      select: { id: true, name: true, type: true },
    }),
  ])

  if (!history) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true, ...history, paymentMethods })
}
