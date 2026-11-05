import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidateCatalogCache } from '@/lib/catalog'
import { logError } from '@/lib/safe-log'
import { applyPlantillaToSettings, plantillaInputSchema, publicPath, readPlantilla } from '@/lib/plantillas'
import type { Prisma } from '@prisma/client'

type RouteContext = { params: { id: string } }

/**
 * Plantilla del catálogo de UN negocio. Solo superadmin. La plantilla se guarda en businesses.catalog_template y, si es carta,
 * settings.carta_preset / carta_style. El enlace público del cliente (/c/[slug]) no cambia al cambiar de plantilla.
 */

async function requireSuperAdmin(): Promise<{ userId: number } | NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  return { userId: session.userId }
}

const parseId = (raw: string): number | null => {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const id = parseId(params.id)
  if (id === null) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const business = await prisma.business.findUnique({ where: { id }, select: { catalog_slug: true, catalog_template: true, settings: true } })
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  return NextResponse.json({
    ok:         true,
    plantilla:  readPlantilla(business),
    public_url: business.catalog_slug ? publicPath(business.catalog_slug) : null,
  })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const id = parseId(params.id)
  if (id === null) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  try {
    const input = plantillaInputSchema.parse(await req.json())
    const business = await prisma.business.findUnique({ where: { id }, select: { catalog_slug: true, catalog_template: true, settings: true } })
    if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const before = readPlantilla(business)
    const settings = applyPlantillaToSettings(business.settings, input) as Prisma.InputJsonObject
    await prisma.$transaction([
      prisma.business.update({ where: { id }, data: { catalog_template: input.template, settings } }),
      prisma.activityLog.create({
        data: {
          business_id: id,
          user_id:     auth.userId,
          action:      'plantilla_updated',
          model_type:  'Business',
          model_id:    id,
          old_values:  { ...before },
          new_values:  { ...input },
        },
      }),
    ])
    await revalidateCatalogCache(id)

    const after = await prisma.business.findUnique({ where: { id }, select: { catalog_template: true, settings: true } })
    return NextResponse.json({
      ok:         true,
      plantilla:  readPlantilla(after ?? { catalog_template: input.template, settings }),
      public_url: business.catalog_slug ? publicPath(business.catalog_slug) : null,
    })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    logError('PATCH /api/admin/tenants/[id]/plantilla', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
