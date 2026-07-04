import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import { catalogLimiter, getClientIp } from '@/lib/rate-limit'
import { CATALOG_WHERE_FILTER, computeAvailability, isCatalogLive } from '@/lib/catalog'

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
      catalog_plan:            true,
      subscription_active:     true,
      subscription_expires_at: true,
    },
  })

  if (!business || !isCatalogLive(business)) {
    return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 })
  }

  // No filtrar campos de suscripción al público
  const { catalog_plan, subscription_active, subscription_expires_at, ...publicBusiness } = business

  const [products, rate, stockEntries] = await Promise.all([
    prisma.product.findMany({
      where: {
        business_id:        business.id,
        active:             true,
        show_in_catalog:    true,
        available_in_pos:   true,
        ...CATALOG_WHERE_FILTER,
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
        min_stock:          true,
        badge:              true,
        subcategory:        true,
        is_featured:        true,
        availability:       true,
        catalog_visibility: true,
        category: { select: { name: true } },
      },
      orderBy: [{ is_featured: 'desc' }, { category_id: 'asc' }, { name: 'asc' }],
    }),
    getBcvRate(),
    prisma.inventoryEntry.groupBy({
      by:    ['product_id'],
      where: { business_id: business.id },
      _sum:  { quantity: true, waste: true },
    }),
  ])

  const stockMap = new Map<number, number>()
  for (const e of stockEntries) {
    stockMap.set(
      e.product_id,
      Number(e._sum.quantity ?? 0) - Number(e._sum.waste ?? 0),
    )
  }

  return NextResponse.json({
    ok:       true,
    business: {
      ...publicBusiness,
      catalog_title: publicBusiness.catalog_title ?? publicBusiness.name,
    },
    products: products.map(p => {
      const imgs     = parseImages(p.images)
      const priceUsd = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
      const netQty   = stockMap.get(p.id)
      const isService = p.sale_mode === 'service'
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
        category_name:      p.category?.name ?? null,
        badge:              p.badge ?? 'none',
        subcategory:        p.subcategory ?? null,
        is_featured:        p.is_featured,
        stockQty:           isService ? null : (netQty ?? null),
        outOfStock:         !isService && (netQty ?? 0) <= 0,
        availability:       computeAvailability({
          sale_mode:    p.sale_mode,
          availability: p.availability ?? 'in_stock',
          net_stock:    netQty ?? null,
          min_stock:    p.min_stock !== null ? Number(p.min_stock) : null,
        }),
        catalog_visibility: p.catalog_visibility,
      }
    }),
    rate,
  })
}
