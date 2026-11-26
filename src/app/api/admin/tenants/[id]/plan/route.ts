import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidateCatalogCache } from '@/lib/catalog'
import { ADDON_KEYS, PLAN_LIMITS, PLAN_TIER_KEYS } from '@/lib/plan-limits'
import { ENTITLEMENT_SELECT, entitlementsOf, parseAddons, planOf, serializeAddons } from '@/lib/entitlements'
import type { PlanGetResponse, PlanPatchResponse, TenantPlanState } from '@/types/plan'

type RouteContext = { params: { id: string } }

const PatchSchema = z.object({
  plan:       z.enum(PLAN_TIER_KEYS),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido').nullable().optional(),
  status:     z.enum(['active', 'expired', 'suspended']),
  // Solo si el admin movió el interruptor "Catálogo publicado" en este guardado; si falta, rige el autoencendido de abajo.
  catalog_active: z.boolean().optional(),
  // CONJUNTO ABSOLUTO de add-ons deseado (idempotente, nunca "alternar"). Omitido = sin cambios; [] = quitar todos.
  addons:     z.array(z.enum(ADDON_KEYS)).max(ADDON_KEYS.length * 2).optional(),
})

const OPEN_KDS = ['received', 'preparing', 'ready'] as const

/** Estado canónico del tenant, leído de la DB (dentro de la transacción si se pasa `tx`). */
async function readState(db: Prisma.TransactionClient, id: number): Promise<TenantPlanState | null> {
  const b = await db.business.findUnique({ where: { id }, select: { id: true, catalog_active: true, ...ENTITLEMENT_SELECT } })
  if (!b) return null
  const open = await db.order.count({ where: { business_id: id, send_to_kds: true, status: { in: [...OPEN_KDS] } } })
  return {
    id:                      b.id,
    catalog_plan:            planOf(b),
    catalog_active:          b.catalog_active,
    subscription_active:     b.subscription_active,
    subscription_expires_at: b.subscription_expires_at ? b.subscription_expires_at.toISOString().slice(0, 10) : null,
    addons:                  parseAddons(b.addons),
    modules_enabled:         (b.modules_enabled ?? '').split(',').filter(Boolean),
    entitlements:            entitlementsOf(b),
    open_kds_orders:         open,
  }
}

/* ── GET /api/admin/tenants/[id]/plan — estado canónico (conteo de cocina abierto incluido) ── */

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const id = parseInt(params.id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const business = await readState(prisma, id)
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true, business } satisfies PlanGetResponse)
}

/* ── PATCH /api/admin/tenants/[id]/plan — plan + estado + add-ons (derechos; NUNCA toca modules_enabled ni borra datos) ── */

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

  const result = await prisma.$transaction(async (tx) => {
    // Cerrojo de la fila: dos guardados del admin sobre el mismo tenant no se pisan (se evalúa sobre lo ya confirmado).
    await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${id} FOR UPDATE`
    const existing = await tx.business.findUnique({
      where:  { id },
      select: { id: true, catalog_active: true, addons: true, catalog_plan: true, subscription_active: true, subscription_expires_at: true },
    })
    if (!existing) return null

    // Cambio de DERECHO de cuenta (plan, suspensión o vencimiento): queda en la bitácora con old/new. Solo si algo cambió de verdad.
    const ymd = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null)
    const prevPlan    = existing.catalog_plan ?? 'gratis'
    const nextActive  = data.status !== 'suspended'
    const nextExpires = data.expires_at === undefined ? ymd(existing.subscription_expires_at) : (data.expires_at ?? null)
    const planChanged = prevPlan !== data.plan || existing.subscription_active !== nextActive || ymd(existing.subscription_expires_at) !== nextExpires

    // Publicación del catálogo: el interruptor manda si vino; si no, un plan CON catálogo en estado Activo lo enciende solo
    // (un negocio creado por registro quedaba con catalog_active=0 y /c/[slug] daba "no disponible" aunque todo se viera "Activo").
    const planHasCatalog = PLAN_LIMITS[data.plan].catalog
    const autoPublish    = data.catalog_active === undefined && planHasCatalog && data.status === 'active' && !existing.catalog_active
    const nextCatalogActive = data.catalog_active ?? (autoPublish ? true : existing.catalog_active)
    const catalogChanged    = nextCatalogActive !== existing.catalog_active

    // Add-ons: conjunto absoluto, normalizado (sin repetidos, orden estable). Solo se escribe y se registra si CAMBIÓ.
    const prevAddons = parseAddons(existing.addons)
    const nextAddons = data.addons === undefined ? prevAddons : parseAddons(serializeAddons(data.addons))
    const addonsChanged = serializeAddons(prevAddons) !== serializeAddons(nextAddons)

    // subscription_active es la única bandera on/off en DB — 'suspended' la apaga, cualquier otro status la deja activa
    // ('trial'/'expired' son estados derivados de catalog_plan/subscription_expires_at, no algo que se fuerce aparte)
    await tx.business.update({
      where: { id },
      data: {
        catalog_plan:        data.plan,
        subscription_active: data.status !== 'suspended',
        catalog_active:      nextCatalogActive,
        ...(addonsChanged ? { addons: serializeAddons(nextAddons) } : {}),
        ...(data.expires_at !== undefined
          ? { subscription_expires_at: data.expires_at ? new Date(`${data.expires_at}T12:00:00`) : null }
          : {}),
      },
    })
    if (planChanged) {
      await tx.activityLog.create({
        data: {
          business_id: id, user_id: session.userId, action: 'plan_updated', model_type: 'Business', model_id: id,
          old_values: { catalog_plan: prevPlan, subscription_active: existing.subscription_active, subscription_expires_at: ymd(existing.subscription_expires_at) },
          new_values: { catalog_plan: data.plan, subscription_active: nextActive, subscription_expires_at: nextExpires },
        },
      })
    }
    if (catalogChanged) {
      await tx.activityLog.create({
        data: {
          business_id: id, user_id: session.userId, action: 'catalog_active_updated', model_type: 'Business', model_id: id,
          old_values: { catalog_active: existing.catalog_active }, new_values: { catalog_active: nextCatalogActive, auto: autoPublish },
        },
      })
    }
    if (addonsChanged) {
      await tx.activityLog.create({
        data: {
          business_id: id, user_id: session.userId, action: 'addon_updated', model_type: 'Business', model_id: id,
          old_values: { addons: prevAddons }, new_values: { addons: nextAddons, plan: data.plan },
        },
      })
    }
    return { autoPublish, addonsChanged, business: await readState(tx, id) }
  })

  if (!result || !result.business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  await revalidateCatalogCache(id)

  return NextResponse.json({
    ok: true,
    catalog_published_auto: result.autoPublish,
    addons_changed:         result.addonsChanged,
    business:               result.business,
  } satisfies PlanPatchResponse)
}
