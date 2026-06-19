import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readCachedBcvRate } from '@/lib/bcv'

const ItemSchema = z.object({
  product_id: z.number().int().positive(),
  qty:        z.number().positive(),
  price_usd:  z.number().nonnegative(),
})

const PostSchema = z.object({
  sale_id:        z.number().int().positive(),
  reason:         z.string().min(3).max(500),
  restores_stock: z.boolean().optional().default(true),
  items:          z.array(ItemSchema).min(1).max(50),
})

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const sp     = req.nextUrl.searchParams
  const bid    = session.businessId
  const status = sp.get('status') ?? undefined
  const page   = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const limit  = Math.max(1, Math.min(parseInt(sp.get('limit') ?? '20', 10), 100))

  const where = {
    business_id: bid,
    ...(status ? { status: status as never } : {}),
  }

  const [returns, total] = await Promise.all([
    prisma.return.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      include: {
        sale:  { select: { id: true, ticket_number: true, sold_at: true } },
        items: true,
      },
    }),
    prisma.return.count({ where }),
  ])

  return NextResponse.json({
    ok: true,
    returns: returns.map(r => ({
      ...r,
      total_usd: Number(r.total_usd),
      total_bs:  Number(r.total_bs),
      rate_used: Number(r.rate_used),
      items: r.items.map(i => ({
        ...i,
        qty:       Number(i.qty),
        price_usd: Number(i.price_usd),
        total_usd: Number(i.total_usd),
      })),
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    const body = PostSchema.parse(await req.json())
    const bid  = session.businessId

    // Verify sale belongs to this business
    const sale = await prisma.sale.findFirst({
      where:   { id: body.sale_id, business_id: bid, status: 'paid' },
      include: { items: { select: { product_id: true, quantity: true } } },
    })
    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada o no pagada' }, { status: 404 })
    }

    // Validate: no devolver más de lo vendido
    const soldMap = new Map<number, number>()
    for (const si of sale.items) soldMap.set(si.product_id, Number(si.quantity))

    // Existing approved returns for this sale
    const existingReturns = await prisma.returnItem.findMany({
      where: { return: { sale_id: body.sale_id, status: 'approved' } },
      select: { product_id: true, qty: true },
    })
    const returnedMap = new Map<number, number>()
    for (const ri of existingReturns) {
      returnedMap.set(ri.product_id, (returnedMap.get(ri.product_id) ?? 0) + Number(ri.qty))
    }

    for (const item of body.items) {
      const sold     = soldMap.get(item.product_id) ?? 0
      const returned = returnedMap.get(item.product_id) ?? 0
      if (item.qty > sold - returned) {
        return NextResponse.json({
          error:      'Cantidad a devolver supera lo vendido',
          product_id: item.product_id,
          vendido:    sold,
          ya_devuelto: returned,
          solicitado: item.qty,
        }, { status: 422 })
      }
    }

    const rate     = await readCachedBcvRate()
    const r2       = (x: number) => Math.round(x * 100) / 100
    const totalUsd = r2(body.items.reduce((s, i) => s + i.qty * i.price_usd, 0))

    const result = await prisma.return.create({
      data: {
        business_id:    bid,
        sale_id:        body.sale_id,
        reason:         body.reason,
        restores_stock: body.restores_stock,
        total_usd:      totalUsd,
        total_bs:       r2(totalUsd * rate),
        rate_used:      rate,
        created_by:     session.userId,
        items: {
          create: body.items.map(i => ({
            product_id: i.product_id,
            qty:        i.qty,
            price_usd:  i.price_usd,
            total_usd:  r2(i.qty * i.price_usd),
          })),
        },
      },
      include: { items: true },
    })

    return NextResponse.json({
      ok: true,
      return: {
        ...result,
        total_usd: Number(result.total_usd),
        total_bs:  Number(result.total_bs),
        rate_used: Number(result.rate_used),
        items: result.items.map(i => ({
          ...i,
          qty:       Number(i.qty),
          price_usd: Number(i.price_usd),
          total_usd: Number(i.total_usd),
        })),
      },
    }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('returns POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
