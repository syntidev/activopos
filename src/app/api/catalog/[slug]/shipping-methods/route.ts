import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { catalogLimiter, getClientIp } from '@/lib/rate-limit'
import { isCatalogLive } from '@/lib/catalog'
import type { PublicShippingMethod, ShippingKind } from '@/types/shipping'

// Lectura PÚBLICA de los métodos de envío activos del negocio (el carrito los muestra al elegir envío).
// business_id sale del slug; solo campos aptos para el público.
const slugSchema = z.string().regex(/^[a-z0-9-]{3,50}$/)

export async function GET(req: NextRequest, { params }: { params: { slug: string } }): Promise<NextResponse> {
  try {
    await catalogLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
  }

  const slug = slugSchema.safeParse(params.slug)
  if (!slug.success) return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })

  try {
    const business = await prisma.business.findFirst({
      where:  { catalog_slug: slug.data, catalog_active: true, active: true },
      select: {
        id: true, catalog_plan: true, subscription_active: true, subscription_expires_at: true,
      },
    })
    if (!business || !isCatalogLive(business)) {
      return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 })
    }

    const rows = await prisma.businessShippingMethod.findMany({
      where:   { business_id: business.id, active: true },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      select:  { id: true, code: true, label: true, kind: true, requires_branch: true, instructions: true },
    })
    const methods: PublicShippingMethod[] = rows.map(r => ({ ...r, kind: r.kind as ShippingKind }))
    return NextResponse.json({ ok: true, methods })
  } catch (err) {
    console.error('public shipping-methods error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
