import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { revalidateCatalogCache } from '@/lib/catalog'
import { divisaPriceOf } from '@/lib/catalog-divisa'
import { readFinancingConfig } from '@/lib/financing'
import { CARTA_AVAILABLE, cobroPatchSchema, readCobroEffective, readCobroPrecios } from '@/lib/cobro-precios'
import { logError } from '@/lib/safe-log'

/**
 * Configuración › Cobro y precios. Solo admin; business_id SIEMPRE de la sesión. Ver src/lib/cobro-precios.ts
 * (qué claves existen, cuáles son nuevas y por qué una clave ausente = comportamiento de siempre).
 */

async function requireAdmin(): Promise<{ businessId: number; userId: number } | NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  return { businessId: session.businessId, userId: session.userId }
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const [business, methods, products, rate] = await Promise.all([
    prisma.business.findUnique({ where: { id: auth.businessId }, select: { settings: true, catalog_template: true } }),
    prisma.paymentMethod.findMany({
      where:   { business_id: auth.businessId, is_active: true },
      orderBy: { sort_order: 'asc' },
      select:  { id: true, name: true, type: true, is_financing: true },
    }),
    // vista previa con productos REALES: se prefiere uno con precio Divisa válido
    prisma.product.findMany({
      where:   { business_id: auth.businessId, active: true, price_per_unit_usd: { gt: 0 } },
      orderBy: [{ wholesale_price_usd: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      take:    5,
      select:  { id: true, name: true, price_per_unit_usd: true, wholesale_price_usd: true, wholesale_price_per_kg_usd: true, price_per_kg_usd: true },
    }),
    getActiveRate(auth.businessId).then(r => r.rate),
  ])
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const sample = products.find(p => divisaPriceOf(p) !== null) ?? products[0] ?? null
  return NextResponse.json({
    ok:        true,
    config:    readCobroPrecios(business, auth.businessId),
    effective: readCobroEffective(business.settings),
    financing: readFinancingConfig(business.settings, auth.businessId),
    carta_available: CARTA_AVAILABLE,
    methods,
    rate,
    preview: sample && {
      name:       sample.name,
      full_usd:   Number(sample.price_per_unit_usd),
      divisa_usd: divisaPriceOf(sample),
    },
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const patch = cobroPatchSchema.parse(await req.json())

    // Los métodos Divisa deben ser medios ACTIVOS de ESTE negocio (nunca ids ajenos).
    if (patch.divisa_method_ids) {
      const ids = Array.from(new Set(patch.divisa_method_ids))
      const own = await prisma.paymentMethod.count({ where: { id: { in: ids }, business_id: auth.businessId, is_active: true } })
      if (own !== ids.length) return NextResponse.json({ error: 'Algún método de pago no existe o está inactivo.' }, { status: 422 })
      patch.divisa_method_ids = ids
    }

    const business = await prisma.business.findUnique({ where: { id: auth.businessId }, select: { settings: true, catalog_template: true } })
    if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const before = readCobroPrecios(business, auth.businessId)
    const existing = (business.settings ?? {}) as Record<string, unknown>
    const stored = (typeof existing.cobro_precios === 'object' && existing.cobro_precios !== null ? existing.cobro_precios : {}) as Record<string, unknown>

    const cobro = {
      ...stored,
      ...(patch.collect_in !== undefined ? { collect_in: patch.collect_in } : {}),
      ...(patch.divisa_enabled !== undefined ? { divisa_enabled: patch.divisa_enabled } : {}),
      ...(patch.cashea_enabled !== undefined ? { cashea_enabled: patch.cashea_enabled } : {}),
    }
    // Cashea: el interruptor del negocio también gobierna el flujo de financiamiento ya existente (misma clave, sin duplicar).
    const financing = patch.cashea_enabled !== undefined
      ? { ...readFinancingConfig(existing, auth.businessId), enabled: patch.cashea_enabled }
      : null

    const settings = {
      ...existing,
      cobro_precios: cobro,
      ...(patch.divisa_method_ids !== undefined ? { catalog_divisa_methods: patch.divisa_method_ids } : {}),
      ...(financing ? { financing, catalog_financing_badge: financing.enabled && financing.mode === 'cashea' ? 'cashea' : null } : {}),
    }

    await prisma.$transaction([
      prisma.business.update({
        where: { id: auth.businessId },
        data:  { settings, ...(patch.template !== undefined ? { catalog_template: patch.template } : {}) },
      }),
      prisma.activityLog.create({
        data: {
          business_id: auth.businessId,
          user_id:     auth.userId,
          action:      'cobro_precios_updated',
          model_type:  'Business',
          model_id:    auth.businessId,
          old_values:  { ...before },
          new_values:  { ...patch },
        },
      }),
    ])
    await revalidateCatalogCache(auth.businessId)

    const after = await prisma.business.findUnique({ where: { id: auth.businessId }, select: { settings: true, catalog_template: true } })
    return NextResponse.json({
      ok:        true,
      config:    readCobroPrecios(after ?? business, auth.businessId),
      effective: readCobroEffective((after ?? business).settings),
    })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    logError('PATCH /api/config/cobro-precios', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
