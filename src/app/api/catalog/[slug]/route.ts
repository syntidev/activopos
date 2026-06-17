import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import { catalogLimiter, getClientIp } from '@/lib/rate-limit'

const slugSchema = z.string().regex(/^[a-z0-9-]{3,50}$/)

function parseImages(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    await catalogLimiter.consume(getClientIp(_req))
  } catch {
    return NextResponse.json(
      { error: 'Demasiados intentos. Intenta más tarde.' },
      { status: 429 }
    )
  }

  const parsed = slugSchema.safeParse(params.slug)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const { data: slug } = parsed

  const business = await prisma.business.findFirst({
    where: { catalog_slug: slug, catalog_active: true, active: true },
    select: {
      id:           true,
      name:         true,
      logo_path:    true,
      phone:        true,
      city:         true,
      state:        true,
      catalog_title: true,
      catalog_desc:  true,
      theme_color:   true,
    },
  })

  if (!business) {
    return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 })
  }

  const [products, rate] = await Promise.all([
    prisma.product.findMany({
      where: {
        business_id:      business.id,
        active:           true,
        show_in_catalog:  true,
        available_in_pos: true,
      },
      select: {
        id:                 true,
        name:               true,
        description:        true,
        price_per_unit_usd: true,
        price_per_kg_usd:   true,
        sku:                true,
        images:             true,
        sale_mode:          true,
        base_unit_label:    true,
        category: { select: { name: true } },
      },
      orderBy: [{ category_id: 'asc' }, { name: 'asc' }],
    }),
    getBcvRate(),
  ])

  return NextResponse.json({
    ok:       true,
    business: {
      ...business,
      catalog_title: business.catalog_title ?? business.name,
    },
    products: products.map(p => {
      const imgs     = parseImages(p.images)
      const priceUsd = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
      return {
        id:            p.id,
        name:          p.name,
        description:   p.description,
        sku:           p.sku,
        price_usd:     priceUsd > 0 ? priceUsd : null,
        price_bs:      priceUsd > 0 ? Math.round(priceUsd * rate * 100) / 100 : null,
        image_url:     imgs[0] ?? null,
        sale_mode:     p.sale_mode,
        base_unit_label: p.base_unit_label,
        category_name: p.category?.name ?? null,
      }
    }),
    rate,
  })
}
