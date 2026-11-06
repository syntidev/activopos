import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidateCatalogCache } from '@/lib/catalog'
import { PLAN_LIMITS } from '@/lib/plan-limits'

type RouteContext = { params: { id: string } }

const PatchSchema = z.object({
  plan:       z.enum(['gratis', 'negocio_activo']),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido').nullable().optional(),
  status:     z.enum(['active', 'expired', 'suspended']),
  // Solo si el admin movió el interruptor "Catálogo publicado" en este guardado; si falta, rige el autoencendido de abajo.
  catalog_active: z.boolean().optional(),
})

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  let data: z.infer<typeof PatchSchema>
  try {
    data = PatchSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  const existing = await prisma.business.findUnique({ where: { id }, select: { id: true, catalog_active: true } })
  if (!existing) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  // Publicación del catálogo: el interruptor manda si vino; si no, un plan CON catálogo en estado Activo lo enciende solo
  // (un negocio creado por registro quedaba con catalog_active=0 y /c/[slug] daba "no disponible" aunque todo se viera "Activo").
  const planHasCatalog = PLAN_LIMITS[data.plan].catalog
  const autoPublish    = data.catalog_active === undefined && planHasCatalog && data.status === 'active' && !existing.catalog_active
  const nextCatalogActive = data.catalog_active ?? (autoPublish ? true : existing.catalog_active)
  const catalogChanged    = nextCatalogActive !== existing.catalog_active

  // subscription_active es la única bandera on/off en DB — 'suspended' la apaga, cualquier otro status la deja activa
  // ('trial'/'expired' son estados derivados de catalog_plan/subscription_expires_at, no algo que se fuerce aparte)
  const update = prisma.business.update({
    where: { id },
    data: {
      catalog_plan:        data.plan,
      subscription_active: data.status !== 'suspended',
      catalog_active:      nextCatalogActive,
      ...(data.expires_at !== undefined
        ? { subscription_expires_at: data.expires_at ? new Date(`${data.expires_at}T12:00:00`) : null }
        : {}),
    },
    select: { id: true, catalog_plan: true, catalog_active: true, subscription_active: true, subscription_expires_at: true },
  })
  const [business] = catalogChanged
    ? await prisma.$transaction([
        update,
        prisma.activityLog.create({
          data: {
            business_id: id,
            user_id:     session.userId,
            action:      'catalog_active_updated',
            model_type:  'Business',
            model_id:    id,
            old_values:  { catalog_active: existing.catalog_active },
            new_values:  { catalog_active: nextCatalogActive, auto: autoPublish },
          },
        }),
      ])
    : [await update]
  await revalidateCatalogCache(id)

  return NextResponse.json({
    ok: true,
    catalog_published_auto: autoPublish,
    business: {
      ...business,
      subscription_expires_at: business.subscription_expires_at
        ? business.subscription_expires_at.toISOString().slice(0, 10)
        : null,
    },
  })
}
