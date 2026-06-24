import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface StockRow {
  product_id: number
  name:       string
  net_qty:    string | number
  min_stock:  string | number
  last_entry_at: Date | null
}

interface NotificationItem {
  id:         number
  type:       'order' | 'stock' | 'cxc'
  title:      string
  body:       string
  read:       boolean
  created_at: string
  url:        string
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const bid = session.businessId
  const now = new Date()

  const [business, orders, overdueCredits, lowStockRows] = await Promise.all([
    prisma.business.findUnique({
      where:  { id: bid },
      select: { notifications_last_read: true },
    }),

    prisma.order.findMany({
      where:   { business_id: bid, status: 'received' },
      select:  { id: true, order_number: true, client_name: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take:    20,
    }),

    prisma.sale.findMany({
      where: {
        business_id: bid,
        status:      'pending',
        origin:      'credit',
        due_date:    { lt: now },
      },
      select:  { id: true, client_name: true, total_usd: true, due_date: true },
      orderBy: { due_date: 'asc' },
      take:    20,
    }),

    prisma.$queryRaw<StockRow[]>`
      SELECT
        p.id                           AS product_id,
        p.name,
        IFNULL(ie.net_qty, 0)          AS net_qty,
        p.min_stock,
        ie.last_entry_at
      FROM products p
      LEFT JOIN (
        SELECT product_id,
               SUM(quantity) - SUM(waste) AS net_qty,
               MAX(entered_at)            AS last_entry_at
        FROM inventory_entries
        WHERE business_id = ${bid}
        GROUP BY product_id
      ) ie ON ie.product_id = p.id
      WHERE p.business_id = ${bid}
        AND p.active = 1
        AND IFNULL(ie.net_qty, 0) <= p.min_stock
        AND p.min_stock > 0
      ORDER BY net_qty ASC
      LIMIT 20
    `,
  ])

  const lastRead = business?.notifications_last_read ?? null

  const items: Omit<NotificationItem, 'id'>[] = []

  for (const order of orders) {
    items.push({
      type:       'order',
      title:      'Nuevo pedido del catálogo',
      body:       `Pedido #${order.order_number} de ${order.client_name ?? 'cliente'}`,
      read:       lastRead !== null && order.created_at < lastRead,
      created_at: order.created_at.toISOString(),
      url:        '/pedidos',
    })
  }

  for (const row of lowStockRows) {
    const entryAt = row.last_entry_at ?? now
    const netQty  = Math.max(0, Number(row.net_qty))
    items.push({
      type:       'stock',
      title:      'Stock crítico',
      body:       `${row.name} — quedan ${netQty.toFixed(0)} unidades`,
      read:       lastRead !== null && entryAt < lastRead,
      created_at: entryAt.toISOString(),
      url:        '/productos',
    })
  }

  for (const sale of overdueCredits) {
    if (!sale.due_date) continue
    const days   = Math.floor((now.getTime() - sale.due_date.getTime()) / 86_400_000)
    const amount = Number(sale.total_usd).toFixed(2)
    items.push({
      type:       'cxc',
      title:      'CxC vencida',
      body:       `${sale.client_name ?? 'Cliente'} debe $${amount} desde hace ${days} día${days === 1 ? '' : 's'}`,
      read:       lastRead !== null && sale.due_date < lastRead,
      created_at: sale.due_date.toISOString(),
      url:        '/finanzas',
    })
  }

  items.sort((a, b) => b.created_at.localeCompare(a.created_at))
  const notifications: NotificationItem[] = items
    .slice(0, 20)
    .map((item, i) => ({ ...item, id: i + 1 }))

  const unread_count = notifications.filter(n => !n.read).length

  return NextResponse.json({ ok: true, notifications, unread_count })
}
