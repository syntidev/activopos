import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MONTH_NAMES } from '@/lib/finanzas'

type TopProductRow = {
  product_id:   number
  product_name: string
  images:       string | null
  order_count:  string | number
  catalog_visibility: string
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const bid = session.businessId
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [business, ordersMonthCount, ordersTotalCount, lastOrder, topProductsRaw, productsSummary] =
    await Promise.all([
      prisma.business.findUniqueOrThrow({
        where:  { id: bid },
        select: { catalog_slug: true },
      }),

      prisma.order.count({
        where: { business_id: bid, created_at: { gte: monthStart, lt: monthEnd } },
      }),

      prisma.order.count({
        where: { business_id: bid },
      }),

      prisma.order.findFirst({
        where:   { business_id: bid },
        orderBy: { created_at: 'desc' },
        select:  { created_at: true },
      }),

      prisma.$queryRaw<TopProductRow[]>`
        SELECT oi.product_id,
               oi.product_name,
               p.images,
               p.catalog_visibility,
               COUNT(oi.id) AS order_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE o.business_id = ${bid}
        GROUP BY oi.product_id, oi.product_name, p.images, p.catalog_visibility
        ORDER BY order_count DESC
        LIMIT 5`,

      prisma.product.groupBy({
        by:    ['catalog_visibility'],
        where: { business_id: bid, active: true, show_in_catalog: true },
        _count: { id: true },
      }),
    ])

  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
  const catalogUrl = business.catalog_slug
    ? `https://activopos.com/catalogo/${business.catalog_slug}`
    : null

  const visibilityCounts = { total: 0, visible: 0, hidden: 0, on_request: 0 }
  for (const g of productsSummary) {
    const count = g._count.id
    visibilityCounts.total   += count
    if (g.catalog_visibility === 'visible')    visibilityCounts.visible    += count
    if (g.catalog_visibility === 'hidden')     visibilityCounts.hidden     += count
    if (g.catalog_visibility === 'on_request') visibilityCounts.on_request += count
  }

  return NextResponse.json({
    ok:          true,
    period:      monthLabel,
    catalog_url: catalogUrl,
    qr_data:     catalogUrl,

    // Sin tabla de tracking — sin fachada
    views: null,

    orders: {
      this_month:    ordersMonthCount,
      total:         ordersTotalCount,
      last_order_at: lastOrder?.created_at?.toISOString() ?? null,
    },

    top_products: topProductsRaw.map(p => {
      let imageUrl: string | null = null
      if (p.images) {
        try {
          const imgs = JSON.parse(p.images) as string[]
          imageUrl = imgs[0] ?? null
        } catch { /* no-op */ }
      }
      return {
        id:                 Number(p.product_id),
        name:               p.product_name,
        image_url:          imageUrl,
        order_count:        parseInt(String(p.order_count), 10),
        catalog_visibility: p.catalog_visibility ?? 'visible',
      }
    }),

    products_summary: visibilityCounts,
  })
}
