import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES   = ['open', 'answered', 'closed']
const VALID_CATEGORIES = ['billing', 'technical', 'general']

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status   = searchParams.get('status') ?? ''
  const category = searchParams.get('category') ?? ''

  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(status && VALID_STATUSES.includes(status) ? { status } : {}),
      ...(category && VALID_CATEGORIES.includes(category) ? { category } : {}),
    },
    include: { business: { select: { name: true } } },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({
    ok: true,
    tickets: tickets.map(t => ({
      id:            t.id,
      business_name: t.business.name,
      subject:       t.subject,
      category:      t.category,
      status:        t.status,
      created_at:    t.created_at,
    })),
  })
}
