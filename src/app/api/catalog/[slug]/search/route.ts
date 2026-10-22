import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { catalogLimiter, catalogSearchSlugLimiter, getClientIp } from '@/lib/rate-limit'
import { CATALOG_WHERE_FILTER, isCatalogLive } from '@/lib/catalog'
import { matchVariant, parseSearch, productSearchWhere } from '@/lib/product-search'
import { logError } from '@/lib/safe-log'

/**
 * GET /api/catalog/[slug]/search?q=...   (público, sin sesión)
 * Misma búsqueda que Productos y el POS (lib/product-search.ts: nombre, barcode, SKU, "Ref" en la descripción,
 * SKU y barcode de variante), SOLO sobre productos visibles en el catálogo. Devuelve únicamente ids y la talla que
 * coincidió: el catálogo ya tiene los datos de cada producto y los códigos de barras no salen al público.
 *   { ok, q, results: [{ id, matched_variant_id, matched_variant_value, matched_by }] }
 * business_id sale del slug (validado con regex), nunca del cliente.
 */
const slugSchema = z.string().regex(/^[a-z0-9-]{3,50}$/)
const MAX_RESULTS = 60

export async function GET(req: NextRequest, { params }: { params: { slug: string } }): Promise<NextResponse> {
  try {
    await catalogLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json({ error: 'Demasiadas búsquedas. Espera un momento.' }, { status: 429 })
  }

  const slug = slugSchema.safeParse(params.slug)
  if (!slug.success) return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })

  // Tope por catálogo (además del de IP): muchas IPs no pueden raspar el mismo slug.
  try {
    await catalogSearchSlugLimiter.consume(slug.data)
  } catch {
    return NextResponse.json({ error: 'Demasiadas búsquedas. Espera un momento.' }, { status: 429 })
  }

  try {
    const parsed = parseSearch(req.nextUrl.searchParams.get('q'))
    const where = productSearchWhere(parsed)
    if (!where) return NextResponse.json({ ok: true, q: '', results: [] })

    const business = await prisma.business.findFirst({
      where:  { catalog_slug: slug.data, catalog_active: true, active: true },
      select: { id: true, catalog_plan: true, subscription_active: true, subscription_expires_at: true },
    })
    if (!business || !isCatalogLive(business)) return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 })

    const products = await prisma.product.findMany({
      where: {
        business_id:      business.id,
        active:           true,
        available_in_pos: true,
        ...CATALOG_WHERE_FILTER,
        AND:              [where],
      },
      select: { id: true, variants: { where: { is_active: true }, select: { id: true, valor: true, sku: true, barcode: true } } },
      take:   MAX_RESULTS,
    })

    const results = products
      .map(p => ({ id: p.id, ...matchVariant(p.variants, parsed) }))
      // los que coinciden por una talla concreta (barcode / SKU) primero
      .sort((a, b) => Number(b.matched_variant_id !== null) - Number(a.matched_variant_id !== null))
    return NextResponse.json({ ok: true, q: parsed.q, results })
  } catch (err) {
    logError('catalog search error', err)
    return NextResponse.json({ error: 'No se pudo buscar. Intenta de nuevo.' }, { status: 500 })
  }
}
