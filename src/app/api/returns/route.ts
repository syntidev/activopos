import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

const ItemSchema = z.object({
  product_id: z.number().int().positive(),
  qty:        z.number().positive(),
})

const PostSchema = z.object({
  sale_id:        z.number().int().positive(),
  reason:         z.string().min(3).max(500),
  restores_stock: z.boolean().optional().default(true),
  items:          z.array(ItemSchema).min(1).max(50),
})

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const sp     = req.nextUrl.searchParams
    const status = sp.get('status') ?? undefined
    const page   = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
    const limit  = Math.max(1, Math.min(parseInt(sp.get('limit') ?? '20', 10), 100))

    const where = {
      // business_id inyectado por el tenant layer
      ...(status ? { status: status as never } : {}),
    }

    const [returns, total] = await Promise.all([
      db.return.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        include: {
          sale:  { select: { id: true, ticket_number: true, sold_at: true } },
          items: true,
        },
      }),
      db.return.count({ where }),
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
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const body = PostSchema.parse(await req.json())
    const bid  = session.businessId

    // Verify sale belongs to this business (fuera del $transaction) → tenant layer
    const sale = await db.sale.findFirst({
      where:   { id: body.sale_id }, // business_id inyectado
      include: { items: { select: { product_id: true, quantity: true, price_per_unit_usd: true } } },
    })
    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    }
    if (sale.status === 'returned') {
      return NextResponse.json({ error: 'Esta venta ya fue devuelta.' }, { status: 409 })
    }
    if (sale.status !== 'paid') {
      return NextResponse.json({ error: 'Venta no encontrada o no pagada' }, { status: 404 })
    }

    // Build price map from server — never trust client-supplied prices
    const priceMap = new Map<number, number>()
    for (const si of sale.items) priceMap.set(si.product_id, Number(si.price_per_unit_usd))

    // Validate: no devolver más de lo vendido
    const soldMap = new Map<number, number>()
    for (const si of sale.items) soldMap.set(si.product_id, Number(si.quantity))

    // ReturnItem no tiene business_id — se filtra por la relación return.business_id
    const existingReturns = await db.returnItem.findMany({
      where: { return: { sale_id: body.sale_id, business_id: bid, status: 'approved' } },
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

    // Total vs parcial: TOTAL solo si, tras esta devolución, cada ítem vendido
    // queda devuelto en su cantidad completa. Si queda algo sin devolver (un
    // producto no incluido, o una cantidad parcial), la venta sigue visible
    // en el P&L como partial_return.
    const requestedMap = new Map<number, number>()
    for (const i of body.items) {
      requestedMap.set(i.product_id, (requestedMap.get(i.product_id) ?? 0) + i.qty)
    }
    let isFullReturn = true
    for (const [productId, soldQty] of Array.from(soldMap)) {
      const totalReturned = (returnedMap.get(productId) ?? 0) + (requestedMap.get(productId) ?? 0)
      if (Math.abs(totalReturned - soldQty) > 0.001) { isFullReturn = false; break }
    }
    const newSaleStatus = isFullReturn ? 'returned' : 'partial_return'

    const rate     = Number(sale.rate_used)
    const r2       = (x: number) => Math.round(x * 100) / 100
    const totalUsd = r2(body.items.reduce((s, i) => s + i.qty * (priceMap.get(i.product_id) ?? 0), 0))

    // $transaction en prisma base: business_id manual adentro
    const result = await prisma.$transaction(async tx => {
      // TOCTOU guard: atomically claim the sale for this return
      const { count } = await tx.sale.updateMany({
        where: { id: body.sale_id, business_id: bid, status: 'paid' },
        data:  { status: newSaleStatus },
      })
      if (count === 0) {
        throw Object.assign(new Error('ALREADY_RETURNED'), { code: 'ALREADY_RETURNED' })
      }

      const ret = await tx.return.create({
        data: {
          business_id:    bid,
          sale_id:        body.sale_id,
          reason:         body.reason,
          status:         'approved',
          restores_stock: body.restores_stock,
          total_usd:      totalUsd,
          total_bs:       r2(totalUsd * rate),
          rate_used:      rate,
          created_by:     session.userId,
          items: {
            create: body.items.map(i => {
              const unitPrice = priceMap.get(i.product_id) ?? 0
              return {
                product_id: i.product_id,
                qty:        i.qty,
                price_usd:  unitPrice,
                total_usd:  r2(i.qty * unitPrice),
              }
            }),
          },
        },
        include: { items: true },
      })

      if (body.restores_stock) {
        await tx.inventoryEntry.createMany({
          data: body.items.map(i => ({
            business_id: bid,
            product_id:  i.product_id,
            quantity:    i.qty,
            waste:       0,
            entry_type:  'return',
            notes:       `DEVOLUCIÓN #${ret.id}`,
            created_by:  session.userId,
          })),
        })
      }

      return ret
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
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if ((err as { code?: string }).code === 'ALREADY_RETURNED') {
      return NextResponse.json({ error: 'Esta venta ya fue devuelta.' }, { status: 409 })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('returns POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
