import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { FINANCING_BADGES, isFinancingBadgeKey } from '@/lib/financing-badges'
import { stockDisplayOf, revalidateCatalogCache } from '@/lib/catalog'
import { CASHEA_PRESET, buildFinancingConfig, financingInputSchema, readFinancingConfig } from '@/lib/financing'
import type { FinancingConfig } from '@/lib/financing'
import { readSynonyms, synonymsInputSchema } from '@/lib/search-synonyms'
import { readTrustStrip, trustStripInputSchema } from '@/lib/trust-strip'

const financingSchema = z.object({
  // Config de financiamiento completa (modo, nombre, frase, logo). Ver .doc/CONTRATO_FINANCIAMIENTO.md.
  financing:               financingInputSchema.optional(),
  // Interruptor viejo (solo Cashea): se sigue aceptando mientras la pantalla de Tema no migre a `financing`.
  catalog_financing_badge: z.enum(Object.keys(FINANCING_BADGES) as [string, ...string[]]).nullable().optional(),
  catalog_stock_display:   z.enum(['exact', 'status']).optional(),
  // Grupos de sinónimos de búsqueda (se normalizan y validan en lib/search-synonyms.ts).
  search_synonyms:         synonymsInputSchema.optional(),
  // Franja de confianza de la home premium (3 items título/descripción).
  trust_strip:             trustStripInputSchema.optional(),
}).refine(d => d.financing !== undefined || d.catalog_financing_badge !== undefined || d.catalog_stock_display !== undefined || d.search_synonyms !== undefined || d.trust_strip !== undefined, { message: 'Nada que guardar' })

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
      financing:               readFinancingConfig(settings, session.businessId),
      catalog_stock_display:   stockDisplayOf(settings),
      search_synonyms:         readSynonyms(settings),
      trust_strip:             readTrustStrip(settings),
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

    let financing: FinancingConfig | undefined
    if (data.financing) {
      const built = buildFinancingConfig(data.financing, session.businessId)
      if (!built.ok) return NextResponse.json({ error: built.error, field: built.field }, { status: 422 })
      financing = built.config
    } else if (data.catalog_financing_badge !== undefined) {
      // Pantalla vieja (solo Cashea): se traduce a la config nueva sin perder lo ya configurado.
      const current = readFinancingConfig(existing, session.businessId)
      financing = data.catalog_financing_badge === null
        ? { ...current, enabled: false }
        : { enabled: true, mode: 'cashea', ...CASHEA_PRESET }
    }

    await prisma.business.update({
      where: { id: session.businessId },
      data:  {
        settings: {
          ...existing,
          // catalog_financing_badge se mantiene sincronizado (solo 'cashea' activo) para lo que aún lo lea.
          ...(financing ? { financing: { ...financing }, catalog_financing_badge: financing.enabled && financing.mode === 'cashea' ? 'cashea' : null } : {}),
          ...(data.catalog_stock_display !== undefined ? { catalog_stock_display: data.catalog_stock_display } : {}),
          ...(data.search_synonyms !== undefined ? { search_synonyms: data.search_synonyms } : {}),
          ...(data.trust_strip !== undefined ? { trust_strip: data.trust_strip } : {}),
        },
      },
    })
    await revalidateCatalogCache(session.businessId)

    return NextResponse.json({ ok: true, financing: financing ?? readFinancingConfig(existing, session.businessId) })
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
