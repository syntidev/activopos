import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'

/* ── Query schema ── */

const querySchema = z.object({
  status: z.enum(['received', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled']).optional(),
  from:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(50),
})

/* ── Item schema ── */

const orderItemSchema = z.object({
  product_id:         z.number().int().positive(),
  product_name:       z.string().min(1).max(120),
  variant_label:      z.string().max(100).optional(),
  quantity:           z.number().positive(),
  price_per_unit_usd: z.number().nonnegative(),
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
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const query = querySchema.parse(params)

    const where = {
      business_id: session.businessId,
      ...(query.status && { status: query.status }),
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
      prisma.order.findMany({
        where,
        include: {
          items: true,
          client: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { created_at: 'desc' },
        take: query.limit,
        skip: (query.page - 1) * query.limit,
      }),
      prisma.order.count({ where }),
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
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }
    console.error('orders GET error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/* ── POST /api/orders ── */

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const rate = await getBcvRate()

    // Calculate totals
    const itemsTotal = data.items.reduce(
      (acc, item) => acc + item.quantity * item.price_per_unit_usd,
      0
    )
    const total_usd = Number((itemsTotal + data.delivery_fee).toFixed(2))
    const total_bs  = Number((total_usd * rate).toFixed(2))

    // Generate order number
    const count = await prisma.order.count({ where: { business_id: session.businessId } })
    const order_number = `PED-${String(count + 1).padStart(5, '0')}`

    const order = await prisma.order.create({
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
          create: data.items.map((item) => ({
            product_id:         item.product_id,
            product_name:       item.product_name,
            variant_label:      item.variant_label,
            quantity:           item.quantity,
            price_per_unit_usd: item.price_per_unit_usd,
            subtotal_usd:       Number((item.quantity * item.price_per_unit_usd).toFixed(2)),
          })),
        },
      },
      include: { items: true },
    })

    return NextResponse.json({ ok: true, order }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('orders POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
