import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { signImpersonation, setImpersonationCookie } from '@/lib/impersonation'

type RouteContext = { params: { businessId: string } }

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const businessId = parseInt(params.businessId, 10)
  if (!Number.isInteger(businessId)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const business = await prisma.business.findUnique({
    where:  { id: businessId },
    select: { id: true, name: true },
  })
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const token = await signImpersonation({ businessId: business.id, businessName: business.name })
  setImpersonationCookie(token)

  await prisma.activityLog.create({
    data: {
      business_id: business.id,
      user_id:     session.userId,
      action:      'impersonation_start',
      model_type:  'Business',
      model_id:    business.id,
      new_values:  { super_admin_name: session.name },
    },
  })

  return NextResponse.json({ ok: true })
}
