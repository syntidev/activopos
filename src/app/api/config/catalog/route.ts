import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { FINANCING_BADGES, isFinancingBadgeKey } from '@/lib/financing-badges'

const financingSchema = z.object({
  catalog_financing_badge: z.enum(Object.keys(FINANCING_BADGES) as [string, ...string[]]).nullable(),
})

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
    select: { catalog_plan: true, catalog_slug: true, settings: true },
  })
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const settings = (business.settings ?? {}) as Record<string, unknown>
  const badge    = settings.catalog_financing_badge

  return NextResponse.json({
    ok:      true,
    catalog: {
      catalog_plan:            business.catalog_plan,
      catalog_slug:            business.catalog_slug,
      catalog_financing_badge: isFinancingBadgeKey(badge) ? badge : null,
    },
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  try {
    const data = financingSchema.parse(await req.json())

    const business = await prisma.business.findUnique({
      where:  { id: session.businessId },
      select: { settings: true },
    })
    const existing = (business?.settings ?? {}) as Record<string, unknown>

    await prisma.business.update({
      where: { id: session.businessId },
      data:  { settings: { ...existing, catalog_financing_badge: data.catalog_financing_badge } },
    })

    return NextResponse.json({ ok: true, catalog_financing_badge: data.catalog_financing_badge })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('PATCH /api/config/catalog:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
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
