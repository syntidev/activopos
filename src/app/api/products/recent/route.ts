import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'

export async function GET(): Promise<NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const register = await prisma.cashRegister.findFirst({
    where: { business_id: session.businessId, closed_at: null },
  })

  if (!register) return NextResponse.json({ ok: true, products: [] })

  // Group saleItems by product_id, ordered by most recent (max id desc)
  const groups = await prisma.saleItem.groupBy({
    by: ['product_id'],
    where: {
      sale: {
        business_id: session.businessId,
        status: 'paid',
        sold_at: { gte: register.opened_at },
      },
    },
    _max: { id: true },
    orderBy: { _max: { id: 'desc' } },
    take: 8,
  })

  if (groups.length === 0) return NextResponse.json({ ok: true, products: [] })

  const productIds = groups.map(g => g.product_id)

  const [rawProducts, rate] = await Promise.all([
    prisma.product.findMany({
      where: {
        id: { in: productIds },
        active: true,
        is_available: true,
      },
      select: {
        id: true,
        name: true,
        sale_mode: true,
        product_type: true,
        base_unit_label: true,
        price_per_unit_usd: true,
        price_per_kg_usd: true,
        cost_per_unit_usd: true,
        images: true,
        is_favorite: true,
        has_variants: true,
        inventory_entries: {
          select: { quantity: true, waste: true },
        },
      },
    }),
    getBcvRate(),
  ])

  // Preserve recency order from groupBy
  const byId = new Map(rawProducts.map(p => [p.id, p]))
  const products = productIds
    .map(id => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map(p => {
      const priceUsd =
        p.sale_mode === 'weight'
          ? (p.price_per_kg_usd ? Number(p.price_per_kg_usd) : null)
          : (p.price_per_unit_usd ? Number(p.price_per_unit_usd) : null)

      let parsedImages: string[] = []
      if (p.images) {
        try { parsedImages = JSON.parse(p.images) as string[] } catch { /* skip */ }
      }

      const netQty = p.inventory_entries.reduce(
        (sum, e) => sum + Number(e.quantity) - Number(e.waste),
        0,
      )

      return {
        id: p.id,
        name: p.name,
        sale_mode: p.sale_mode,
        base_unit_label: p.base_unit_label,
        price_per_unit_usd: p.price_per_unit_usd ? Number(p.price_per_unit_usd) : null,
        price_per_kg_usd: p.price_per_kg_usd ? Number(p.price_per_kg_usd) : null,
        cost_per_unit_usd: p.cost_per_unit_usd ? Number(p.cost_per_unit_usd) : null,
        images: parsedImages,
        is_favorite: p.is_favorite,
        has_variants: p.has_variants,
        stock: { net_qty: Math.max(0, netQty) },
        price_bs: priceUsd !== null ? Math.round(priceUsd * rate * 100) / 100 : null,
      }
    })

  return NextResponse.json({ ok: true, products, rate })
}
