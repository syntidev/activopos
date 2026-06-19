import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ProductRow = {
  product_id:    number
  product_name:  string
  sku:           string | null
  category_name: string | null
  qty_sold:      string | number
  total_usd:     string | number
}

type PrevRow = {
  product_id: number
  qty_sold:   string | number
}

function parseDate(str: string | null, fallback: Date): Date {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return fallback
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const sp  = req.nextUrl.searchParams
  const bid = session.businessId
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultTo   = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const from  = parseDate(sp.get('from'), defaultFrom)
  const to    = parseDate(sp.get('to'),   defaultTo)
  const limit = Math.max(1, Math.min(parseInt(sp.get('limit') ?? '10', 10), 50))

  if (to <= from) {
    return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 })
  }

  const days     = Math.ceil((to.getTime() - from.getTime()) / 86_400_000)
  const prevFrom = new Date(from.getTime() - days * 86_400_000)
  const prevTo   = from

  const [currentRaw, prevRaw] = await Promise.all([
    prisma.$queryRaw<ProductRow[]>`
      SELECT si.product_id,
             si.product_name,
             p.sku,
             c.name           AS category_name,
             SUM(si.quantity)     AS qty_sold,
             SUM(si.subtotal_usd) AS total_usd
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.business_id = ${bid}
        AND s.status = 'paid'
        AND s.sold_at >= ${from}
        AND s.sold_at <  ${to}
      GROUP BY si.product_id, si.product_name, p.sku, c.name
      ORDER BY qty_sold DESC
      LIMIT ${limit}`,

    prisma.$queryRaw<PrevRow[]>`
      SELECT si.product_id, SUM(si.quantity) AS qty_sold
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.business_id = ${bid}
        AND s.status = 'paid'
        AND s.sold_at >= ${prevFrom}
        AND s.sold_at <  ${prevTo}
      GROUP BY si.product_id`,
  ])

  const r2       = (x: number) => Math.round(x * 100) / 100
  const totalUsd = currentRaw.reduce((s, p) => s + Number(p.total_usd), 0)
  const prevMap  = new Map(prevRaw.map(p => [Number(p.product_id), Number(p.qty_sold)]))

  const products = currentRaw.map(p => {
    const qtyNow  = Number(p.qty_sold)
    const qtyPrev = prevMap.get(Number(p.product_id)) ?? 0
    const diffPct = qtyPrev > 0 ? ((qtyNow - qtyPrev) / qtyPrev) * 100 : 0
    const trend: 'up' | 'down' | 'stable' =
      qtyPrev === 0 ? 'stable' : Math.abs(diffPct) < 5 ? 'stable' : diffPct > 0 ? 'up' : 'down'
    const tUsd = Number(p.total_usd)

    return {
      id:            Number(p.product_id),
      name:          p.product_name,
      sku:           p.sku ?? null,
      category_name: p.category_name ?? null,
      qty_sold:      qtyNow,
      total_usd:     r2(tUsd),
      avg_price_usd: qtyNow > 0 ? r2(tUsd / qtyNow) : 0,
      pct_of_total:  totalUsd > 0 ? r2((tUsd / totalUsd) * 100) : 0,
      trend,
    }
  })

  return NextResponse.json({
    ok: true,
    period: {
      from: from.toISOString().slice(0, 10),
      to:   to.toISOString().slice(0, 10),
    },
    products,
    total_period_usd: r2(totalUsd),
  })
}
