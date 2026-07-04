import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['pending', 'pending_review', 'paid', 'rejected']

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const q      = searchParams.get('q')?.trim() ?? ''
  const status = searchParams.get('status') ?? ''

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(status && VALID_STATUSES.includes(status) ? { status } : {}),
      ...(q ? {
        OR: [
          { invoice_number: { contains: q } },
          { business: { name: { contains: q } } },
        ],
      } : {}),
    },
    include: { business: { select: { name: true } } },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({
    ok: true,
    invoices: invoices.map(inv => ({
      id:             inv.id,
      invoice_number: inv.invoice_number,
      business_name:  inv.business.name,
      amount_usd:     Number(inv.amount_usd),
      channel:        inv.channel,
      reference:      inv.reference,
      created_at:     inv.created_at,
      status:         inv.status,
    })),
  })
}
