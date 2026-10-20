import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { getActiveRate } from '@/lib/bcv'
import { matchVariant, parseSearch, productSearchWhere } from '@/lib/product-search'

function parseImages(raw: string | null): string[] | null {
  if (!raw) return null
  try { return JSON.parse(raw) as string[] } catch { return null }
}

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const sp           = req.nextUrl.searchParams
    // Búsqueda única (lib/product-search.ts): nombre, barcode, SKU, "Ref" en descripción, SKU y barcode de variante.
    const parsed       = parseSearch(sp.get('q'))
    const q            = parsed.q
    const searchWhere  = productSearchWhere(parsed)
    const limit        = Math.min(parseInt(sp.get('limit') ?? '20'), 50)
    const includeEmpty = sp.get('include_empty') !== 'false'

    if (!searchWhere) return NextResponse.json({ ok: true, products: [] })

    const [rawProducts, stockAgg, rate] = await Promise.all([
      db.product.findMany({
        where: {
          // business_id inyectado por el tenant layer
          active:       true,
          is_available: true,
          AND:          [searchWhere],
        },
        select: {
          id:                 true,
          name:               true,
          sku:                true,
          barcode:            true,
          sale_mode:          true,
          product_type:       true,
          base_unit_label:    true,
          price_per_unit_usd: true,
          price_per_kg_usd:   true,
          cost_per_unit_usd:  true,
          wholesale_price_usd:        true,
          wholesale_price_per_kg_usd: true,
          images:             true,
          has_variants:       true,
          is_favorite:        true,
          min_stock:          true,
          variants: {
            where:   { is_active: true },
            select:  {
              id:           true,
              tipo:         true,
              valor:        true,
              precio_extra: true,
              stock:        true,
              sku:          true,
              barcode:      true,
              color_hex:    true,
              sort_order:   true,
            },
            orderBy: [{ sort_order: 'asc' }],
          },
        },
        take: 50,
      }),
      db.inventoryEntry.groupBy({
        by:   ['product_id'],
        // business_id inyectado por el tenant layer
        _sum: { quantity: true, waste: true },
      }),
      getActiveRate(session.businessId).then(r => r.rate),
    ])

    const stockMap = new Map(
      stockAgg.map(s => [
        s.product_id,
        Number(s._sum.quantity ?? 0) - Number(s._sum.waste ?? 0),
      ])
    )

    const qLower = q.toLowerCase()

    const scored = rawProducts
      .map(p => {
        const net_qty  = stockMap.get(p.id) ?? 0
        const priceUsd =
          p.sale_mode === 'weight'
            ? (p.price_per_kg_usd   ? Number(p.price_per_kg_usd)   : null)
            : (p.price_per_unit_usd ? Number(p.price_per_unit_usd) : null)

        const match = matchVariant(p.variants, parsed)
        const nameLower = p.name.toLowerCase()
        let score       = nameLower === qLower ? 100 : nameLower.startsWith(qLower) ? 60 : 20
        if (p.is_favorite) score += 5
        // Un barcode exacto (del producto o de una de sus tallas) va SIEMPRE primero: Enter en el POS toma el primer resultado.
        if (match.matched_by === 'barcode' || (parsed.code !== null && p.barcode === parsed.code)) score += 1000
        else if (match.matched_by === 'sku') score += 500

        return {
          id:                 p.id,
          name:               p.name,
          sale_mode:          p.sale_mode,
          base_unit_label:    p.base_unit_label,
          price_per_unit_usd: p.price_per_unit_usd ? Number(p.price_per_unit_usd) : null,
          price_per_kg_usd:   p.price_per_kg_usd   ? Number(p.price_per_kg_usd)   : null,
          cost_per_unit_usd:  p.cost_per_unit_usd  ? Number(p.cost_per_unit_usd)  : null,
          wholesale_price_usd:        p.wholesale_price_usd        != null ? Number(p.wholesale_price_usd)        : null,
          wholesale_price_per_kg_usd: p.wholesale_price_per_kg_usd != null ? Number(p.wholesale_price_per_kg_usd) : null,
          images:             parseImages(p.images),
          has_variants:       p.has_variants,
          variants:           p.variants.map(v => ({ ...v, precio_extra: Number(v.precio_extra) })),
          // Talla que coincidió (barcode exacto o SKU único): id y valor; null si fue otra coincidencia.
          ...match,
          is_favorite:        p.is_favorite,
          stock:              { net_qty },
          price_bs:           priceUsd ? Math.round(priceUsd * rate * 100) / 100 : null,
          _score:             score,
        }
      })
      .filter(p => includeEmpty || p.stock.net_qty > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...p }) => p)

    return NextResponse.json({ ok: true, products: scored, rate })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
