import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const upgradeSchema = z.object({
  action: z.literal('request_upgrade'),
  plan:   z.string().max(30).optional(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { catalog_plan: true, catalog_slug: true },
  })
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  return NextResponse.json({
    ok:      true,
    catalog: { catalog_plan: business.catalog_plan, catalog_slug: business.catalog_slug },
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const body = await req.json()
    const data = upgradeSchema.parse(body)

    await prisma.activityLog.create({
      data: {
        business_id: session.businessId,
        user_id:     session.userId,
        action:      'catalog_upgrade_requested',
        model_type:  'Business',
        model_id:    session.businessId,
        new_values:  { plan: data.plan ?? 'basic' },
      },
    })

    return NextResponse.json({
      ok:      true,
      message: 'Solicitud registrada. El equipo de ActivoPOS te contactará pronto.',
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('POST /api/config/catalog:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
