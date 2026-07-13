import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { getBcvRate } from '@/lib/bcv'

function parseImages(raw: string | null): string[] | null {
  if (!raw) return null
  try { return JSON.parse(raw) as string[] } catch { return null }
}

export async function GET(req: NextRequest) {
  try {
    const { db } = await getAuthenticatedTenant()

    const sp           = req.nextUrl.searchParams
    const q            = sp.get('q')?.trim() ?? ''
    const limit        = Math.min(parseInt(sp.get('limit') ?? '20'), 50)
    const includeEmpty = sp.get('include_empty') !== 'false'

    if (!q) return NextResponse.json({ ok: true, products: [] })

    type WhereOr =
      | { name:    { contains: string } }
      | { barcode: string }
      | { sku:     { contains: string } }

    const orConditions: WhereOr[] = [
      { name: { contains: q } },
      { sku:  { contains: q } },
    ]
    if (q.length >= 4) orConditions.push({ barcode: q })

    const [rawProducts, stockAgg, rate] = await Promise.all([
      db.product.findMany({
        where: {
          // business_id inyectado por el tenant layer
          active:       true,
          is_available: true,
          OR:           orConditions,
        },
        select: {
          id:                 true,
          name:               true,
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
      getBcvRate(),
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

        const nameLower = p.name.toLowerCase()
        let score       = nameLower === qLower ? 100 : nameLower.startsWith(qLower) ? 60 : 20
        if (p.is_favorite) score += 5

        return {
          id:                 p.id,
          name:               p.name,
          sale_mode:          p.sale_mode,
          base_unit_label:    p.base_unit_label,
          price_per_unit_usd: p.price_per_unit_usd ? Number(p.price_per_unit_usd) : null,
          price_per_kg_usd:   p.price_per_kg_usd   ? Number(p.price_per_kg_usd)   : null,
          cost_per_unit_usd:  p.cost_per_unit_usd  ? Number(p.cost_per_unit_usd)  : null,
          wholesale_price_usd:        p.wholesale_price_usd        ?? null,
          wholesale_price_per_kg_usd: p.wholesale_price_per_kg_usd ?? null,
          images:             parseImages(p.images),
          has_variants:       p.has_variants,
          variants:           p.variants.map(v => ({ ...v, precio_extra: Number(v.precio_extra) })),
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
