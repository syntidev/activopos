import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { MONTH_NAMES } from '@/lib/finanzas'

type TopProductRow = {
  product_id:   number
  product_name: string
  images:       string | null
  order_count:  string | number
  catalog_visibility: string | null
}

export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const bid = session.businessId
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const [business, ordersMonthCount, ordersTotalCount, lastOrder, topProductsRaw, productsSummary] =
      await Promise.all([
        // Business es la raíz del tenant (no tiene business_id) → no se filtra.
        db.business.findUniqueOrThrow({
          where:  { id: bid },
          select: { catalog_slug: true },
        }),

        db.order.count({
          where: { created_at: { gte: monthStart, lt: monthEnd } }, // business_id inyectado
        }),

        db.order.count(), // business_id inyectado por el tenant layer

        db.order.findFirst({
          // business_id inyectado por el tenant layer
          orderBy: { created_at: 'desc' },
          select:  { created_at: true },
        }),

        // $queryRaw NO pasa por el tenant layer — business_id manual obligatorio
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

        db.product.groupBy({
          by:    ['catalog_visibility'],
          // business_id inyectado por el tenant layer
          _count: { id: true },
        }),
      ])

    const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
    const baseUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://activopos.com'
    const catalogUrl = business.catalog_slug
      ? `${baseUrl}/catalogo/${business.catalog_slug}`
      : null

    const visibilityCounts = { total: 0, visible: 0, hidden: 0, on_request: 0 }
    for (const g of productsSummary) {
      const count = g._count.id
      visibilityCounts.total   += count
      if (g.catalog_visibility === 'visible')    visibilityCounts.visible    += count
      if (g.catalog_visibility === 'hidden')     visibilityCounts.hidden     += count
      if (g.catalog_visibility === 'on_request') visibilityCounts.on_request += count
    }

    const qrData = catalogUrl
      ? await QRCode.toDataURL(catalogUrl, { width: 300, margin: 2 })
      : null

    return NextResponse.json({
      ok:          true,
      period:      monthLabel,
      catalog_url: catalogUrl,
      qr_data:     qrData,

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
          catalog_visibility: p.catalog_visibility,
        }
      }),

      products_summary: visibilityCounts,
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
