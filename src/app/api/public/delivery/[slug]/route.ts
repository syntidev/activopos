import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isCatalogLive } from '@/lib/catalog'

const slugSchema = z.string().regex(/^[a-z0-9-]{3,50}$/)

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
): Promise<NextResponse> {
  const parsedSlug = slugSchema.safeParse(params.slug)
  if (!parsedSlug.success) {
    return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })
  }

  const business = await prisma.business.findFirst({
    where: { catalog_slug: parsedSlug.data, catalog_active: true, active: true },
    select: {
      settings: true,
      catalog_plan: true, subscription_active: true, subscription_expires_at: true,
    },
  })

  if (!business || !isCatalogLive(business)) {
    return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 })
  }

  const settings = (business.settings ?? {}) as Record<string, unknown>
  const delivery = (settings.delivery ?? {}) as Record<string, unknown>

  if (!delivery.delivery_enabled) {
    return NextResponse.json({ enabled: false })
  }

  return NextResponse.json({
    enabled:     true,
    fee_default: Number(delivery.delivery_fee_default ?? 0),
    zones:       (delivery.delivery_zones ?? []) as { nombre: string; precio: number }[],
  })
}
