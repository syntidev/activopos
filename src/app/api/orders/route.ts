import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import { createNotification } from '@/lib/notifications'
import { sendPushToBusinessSubscribers } from '@/lib/push-notify'

/* ── Query schema ── */

const querySchema = z.object({
  status:      z.enum(['received', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled']).optional(),
  from:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  send_to_kds: z.enum(['true', 'false']).optional(),
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(50),
})

/* ── Item schema ── */

const orderItemSchema = z.object({
  product_id:    z.number().int().positive(),
  product_name:  z.string().min(1).max(120),
  variant_label: z.string().max(100).optional(),
  quantity:      z.number().positive(),
  // price_per_unit_usd NOT accepted from client — A5-1: always fetched from DB
})

/* ── Create schema ── */

const createSchema = z.object({
  client_id:      z.number().int().positive().optional(),
  client_name:    z.string().min(1).max(120).optional(),
  client_phone:   z.string().max(20).optional(),
  client_address: z.string().max(500).optional(),
  notes:          z.string().max(500).optional(),
  delivery_fee:   z.number().nonnegative().default(0),
  origin:         z.enum(['whatsapp', 'catalog', 'phone', 'pos']).default('whatsapp'),
  estimated_time: z.number().int().positive().optional(),
  items:          z.array(orderItemSchema).min(1),
})

/* ── GET /api/orders ── */

export async function GET(req: NextRequest) {
  try {
    const { db } = await getAuthenticatedTenant()

    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const query = querySchema.parse(params)

    const where = {
      // business_id inyectado por el tenant layer
      ...(query.status && { status: query.status }),
      ...(query.send_to_kds !== undefined && { send_to_kds: query.send_to_kds === 'true' }),
      ...(query.from || query.to
        ? {
            created_at: {
              ...(query.from && { gte: new Date(query.from) }),
              ...(query.to && { lte: new Date(`${query.to}T23:59:59`) }),
            },
          }
        : {}),
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          items: true,
          client: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { created_at: 'desc' },
        take: query.limit,
        skip: (query.page - 1) * query.limit,
      }),
      db.order.count({ where }),
    ])

    return NextResponse.json({
      ok: true,
      orders,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }
    console.error('orders GET error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/* ── POST /api/orders ── */

// Errors thrown inside the transaction that map to 400
const ORDER_400_ERRORS = [
  'Producto no encontrado',
  'Precio no configurado',
]

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    // Fetch BCV rate outside the transaction — avoids holding the tx open during a network call
    const rate = await getBcvRate()

    const order = await prisma.$transaction(async (tx) => {
      // A5-1: prices from DB — anti price-tampering (never trust client-supplied prices)
      const productIds = Array.from(new Set(data.items.map((i) => i.product_id)))
      const products   = await tx.product.findMany({
        where:  { id: { in: productIds }, business_id: session.businessId, active: true },
        select: { id: true, price_per_unit_usd: true, price_per_kg_usd: true },
      })
      if (products.length !== productIds.length) {
        throw new Error('Producto no encontrado o inactivo')
      }
      const productMap = new Map(products.map((p) => [p.id, p]))

      const itemsWithPrices = data.items.map((item) => {
        const product  = productMap.get(item.product_id)!
        const priceUsd = Number(product.price_per_unit_usd ?? product.price_per_kg_usd ?? 0)
        if (priceUsd <= 0) {
          throw new Error(`Precio no configurado para el producto ${item.product_id}`)
        }
        const subtotal_usd = Number((item.quantity * priceUsd).toFixed(2))
        return { ...item, price_per_unit_usd: priceUsd, subtotal_usd }
      })

      const itemsTotal = itemsWithPrices.reduce((acc, item) => acc + item.subtotal_usd, 0)
      const total_usd  = Number((itemsTotal + data.delivery_fee).toFixed(2))
      const total_bs   = Number((total_usd * rate).toFixed(2))

      // A3-1: atomic order_number — no race with concurrent POSTs
      const last = await tx.order.findFirst({
        where:   { business_id: session.businessId },
        orderBy: { id: 'desc' },
        select:  { id: true },
      })
      const next         = (last?.id ?? 0) + 1
      const order_number = `PED-${String(next).padStart(5, '0')}`

      return tx.order.create({
        data: {
          business_id:    session.businessId,
          order_number,
          status:         'received',
          origin:         data.origin,
          client_id:      data.client_id,
          client_name:    data.client_name,
          client_phone:   data.client_phone,
          client_address: data.client_address,
          notes:          data.notes,
          delivery_fee:   data.delivery_fee,
          total_usd,
          total_bs,
          rate_used:      rate,
          estimated_time: data.estimated_time,
          items: {
            create: itemsWithPrices.map((item) => ({
              product_id:         item.product_id,
              product_name:       item.product_name,
              variant_label:      item.variant_label,
              quantity:           item.quantity,
              price_per_unit_usd: item.price_per_unit_usd,
              subtotal_usd:       item.subtotal_usd,
            })),
          },
        },
        include: { items: true },
      })
    })

    // Trigger notification + push for catalog-origin orders
    if (data.origin === 'catalog') {
      const notifTitle = 'Nuevo pedido desde catálogo'
      const notifBody  = `Pedido ${order.order_number}${data.client_name ? ` de ${data.client_name}` : ''} recibido.`
      void createNotification(
        session.businessId, 'order_new', notifTitle, notifBody, 'order', order.id
      ).catch(() => {})
      void sendPushToBusinessSubscribers(session.businessId, {
        title: notifTitle,
        body:  notifBody,
        url:   '/pedidos',
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, order }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    if (err instanceof Error && ORDER_400_ERRORS.some((e) => err.message.startsWith(e))) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('orders POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
