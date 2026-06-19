import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readCachedBcvRate } from '@/lib/bcv'

const ItemSchema = z.object({
  product_id: z.number().int().positive().optional(),
  name:       z.string().min(1).max(120),
  qty:        z.number().positive(),
  price_usd:  z.number().nonnegative(),
})

const PostSchema = z.object({
  client_id:   z.number().int().positive().optional(),
  notes:       z.string().max(2000).optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  items:       z.array(ItemSchema).min(1).max(100),
})

// Auto-expire draft/sent quotations past valid_until
async function expireStale(businessId: number) {
  await prisma.quotation.updateMany({
    where: {
      business_id: businessId,
      status:      { in: ['draft', 'sent'] },
      valid_until: { lt: new Date() },
    },
    data: { status: 'expired' },
  })
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const sp     = req.nextUrl.searchParams
  const bid    = session.businessId
  const status = sp.get('status') ?? undefined
  const page   = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const limit  = Math.max(1, Math.min(parseInt(sp.get('limit') ?? '20', 10), 100))

  await expireStale(bid)

  const where = {
    business_id: bid,
    ...(status ? { status: status as never } : {}),
  }

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        items:  { select: { id: true, name: true, qty: true, price_usd: true, total_usd: true } },
      },
    }),
    prisma.quotation.count({ where }),
  ])

  return NextResponse.json({
    ok: true,
    quotations: quotations.map(q => ({
      ...q,
      subtotal_usd: Number(q.subtotal_usd),
      total_usd:    Number(q.total_usd),
      total_bs:     Number(q.total_bs),
      rate_used:    Number(q.rate_used),
      items: q.items.map(i => ({
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
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const body = PostSchema.parse(await req.json())
    const bid  = session.businessId
    const rate = await readCachedBcvRate()
    const year = new Date().getFullYear()

    const subtotal = body.items.reduce((s, i) => s + i.qty * i.price_usd, 0)
    const r2       = (x: number) => Math.round(x * 100) / 100

    const quotation = await prisma.$transaction(async tx => {
      const count  = await tx.quotation.count({ where: { business_id: bid } })
      const number = `QUO-${year}-${String(count + 1).padStart(4, '0')}`

      return tx.quotation.create({
        data: {
          business_id:  bid,
          client_id:    body.client_id,
          number,
          notes:        body.notes,
          valid_until:  body.valid_until ? new Date(body.valid_until) : undefined,
          subtotal_usd: r2(subtotal),
          total_usd:    r2(subtotal),
          rate_used:    rate,
          total_bs:     r2(subtotal * rate),
          items: {
            create: body.items.map(i => ({
              product_id: i.product_id,
              name:       i.name,
              qty:        i.qty,
              price_usd:  i.price_usd,
              total_usd:  r2(i.qty * i.price_usd),
            })),
          },
        },
        include: {
          client: { select: { id: true, name: true, phone: true } },
          items:  true,
        },
      })
    })

    return NextResponse.json({
      ok: true,
      quotation: {
        ...quotation,
        subtotal_usd: Number(quotation.subtotal_usd),
        total_usd:    Number(quotation.total_usd),
        total_bs:     Number(quotation.total_bs),
        rate_used:    Number(quotation.rate_used),
        items: quotation.items.map(i => ({
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
    console.error('quotations POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
