import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type LowRow = { cnt: string | number }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const bid = session.businessId

  const [pendingOrders, lowStockRows] = await Promise.all([
    prisma.order.count({
      where: { business_id: bid, status: 'received' },
    }),
    prisma.$queryRaw<LowRow[]>`
      SELECT COUNT(*) AS cnt
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(quantity) - SUM(waste) AS net_qty
        FROM inventory_entries
        WHERE business_id = ${bid}
        GROUP BY product_id
      ) inv ON inv.product_id = p.id
      WHERE p.business_id = ${bid}
        AND p.active      = 1
        AND p.min_stock   > 0
        AND COALESCE(inv.net_qty, 0) <= p.min_stock`,
  ])

  return NextResponse.json({
    pending_orders: pendingOrders,
    critical_stock: Number(lowStockRows[0]?.cnt ?? 0),
  })
}
