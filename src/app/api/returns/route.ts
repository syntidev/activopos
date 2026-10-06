import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

const ItemSchema = z.object({
  product_id: z.number().int().positive(),
  qty:        z.number().positive(),
  // Línea EXACTA que se devuelve. Opcional en el request para no romper a quien
  // ya llama sin él: si falta, el servidor la resuelve SOLO cuando el producto
  // aparece en una sola línea de la venta; si hay varias, responde 422 en vez de
  // elegir una (de eso depende el costo con que se revierte el COGS).
  sale_item_id: z.number().int().positive().optional(),
})

const PostSchema = z.object({
  sale_id:        z.number().int().positive(),
  reason:         z.string().min(3).max(500),
  restores_stock: z.boolean().optional().default(true),
  // Método por el que SALE el dinero del reembolso. Obligatorio: sin él no se
  // puede saber si el reembolso afecta el efectivo esperado de la caja
  // (estándar contable 2026-10-06).
  refund_payment_method_id: z.number().int().positive(),
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
      include: {
        items: {
          select: {
            id: true, product_id: true, variant_id: true, quantity: true,
            price_per_unit_usd: true, cost_per_unit_usd: true,
          },
        },
      },
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

    // El método de reembolso tiene que ser del MISMO negocio: si no, un id de
    // otro tenant marcaría el reembolso como efectivo (o no) usando su tabla.
    const refundMethod = await db.paymentMethod.findFirst({
      where:  { id: body.refund_payment_method_id }, // business_id inyectado
      select: { id: true },
    })
    if (!refundMethod) {
      return NextResponse.json({ error: 'Método de reembolso no encontrado' }, { status: 422 })
    }

    // Resolución de LÍNEA por ítem. El costo con que se revierte el COGS sale
    // SIEMPRE del SaleItem en el servidor -- nunca del cliente.
    const itemsById = new Map(sale.items.map(si => [si.id, si]))
    const linesByProduct = new Map<number, typeof sale.items>()
    for (const si of sale.items) {
      const list = linesByProduct.get(si.product_id) ?? []
      list.push(si)
      linesByProduct.set(si.product_id, list)
    }

    const resolved: { product_id: number; qty: number; sale_item_id: number; price_usd: number; cost_per_unit_usd: number | null }[] = []
    for (const item of body.items) {
      let line = item.sale_item_id ? itemsById.get(item.sale_item_id) : undefined
      if (item.sale_item_id && !line) {
        return NextResponse.json(
          { error: 'La línea indicada no pertenece a esta venta', sale_item_id: item.sale_item_id },
          { status: 422 },
        )
      }
      if (line && line.product_id !== item.product_id) {
        return NextResponse.json(
          { error: 'La línea indicada no corresponde a ese producto', sale_item_id: item.sale_item_id },
          { status: 422 },
        )
      }
      if (!line) {
        const candidates = linesByProduct.get(item.product_id) ?? []
        if (candidates.length === 0) {
          return NextResponse.json({ error: 'Producto no está en esta venta', product_id: item.product_id }, { status: 422 })
        }
        if (candidates.length > 1) {
          // Varias líneas del mismo producto (variantes / precio con override):
          // el costo a revertir sería ambiguo. Se exige la línea en vez de elegir.
          return NextResponse.json({
            error:        'Este producto está en varias líneas de la venta: indica sale_item_id',
            product_id:   item.product_id,
            sale_item_ids: candidates.map(c => ({ sale_item_id: c.id, variant_id: c.variant_id, qty: Number(c.quantity) })),
          }, { status: 422 })
        }
        line = candidates[0]
      }
      resolved.push({
        product_id:        item.product_id,
        qty:               item.qty,
        sale_item_id:      line.id,
        price_usd:         Number(line.price_per_unit_usd),
        cost_per_unit_usd: line.cost_per_unit_usd === null ? null : Number(line.cost_per_unit_usd),
      })
    }

    // Validate: no devolver más de lo vendido.
    // SUMA todas las líneas del producto: antes el Map se sobrescribía y, con el
    // mismo producto en 2 líneas, solo contaba la última como vendida.
    const soldMap = new Map<number, number>()
    for (const si of sale.items) soldMap.set(si.product_id, (soldMap.get(si.product_id) ?? 0) + Number(si.quantity))
    const soldByLine = new Map(sale.items.map(si => [si.id, Number(si.quantity)]))

    // ReturnItem no tiene business_id — se filtra por la relación return.business_id
    const existingReturns = await db.returnItem.findMany({
      where: { return: { sale_id: body.sale_id, business_id: bid, status: 'approved' } },
      select: { product_id: true, qty: true, sale_item_id: true },
    })
    const returnedMap = new Map<number, number>()
    const returnedByLine = new Map<number, number>()
    for (const ri of existingReturns) {
      returnedMap.set(ri.product_id, (returnedMap.get(ri.product_id) ?? 0) + Number(ri.qty))
      if (ri.sale_item_id !== null) {
        returnedByLine.set(ri.sale_item_id, (returnedByLine.get(ri.sale_item_id) ?? 0) + Number(ri.qty))
      }
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

    // Tope por LÍNEA: no se puede devolver de una línea más de lo que esa línea
    // vendió (lo de arriba solo acota el total del producto).
    const requestedByLine = new Map<number, number>()
    for (const r of resolved) requestedByLine.set(r.sale_item_id, (requestedByLine.get(r.sale_item_id) ?? 0) + r.qty)
    for (const [lineId, qty] of Array.from(requestedByLine)) {
      const disponible = (soldByLine.get(lineId) ?? 0) - (returnedByLine.get(lineId) ?? 0)
      if (qty > disponible + 0.001) {
        return NextResponse.json({
          error:        'Cantidad a devolver supera lo vendido en esa línea',
          sale_item_id: lineId,
          disponible,
          solicitado:   qty,
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
    // Por LÍNEA, no por producto: dos líneas del mismo producto pueden tener
    // precios distintos (override), y el total debe usar el de cada línea.
    const totalUsd = r2(resolved.reduce((s, r) => s + r.qty * r.price_usd, 0))

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
          refund_payment_method_id: body.refund_payment_method_id,
          created_by:     session.userId,
          items: {
            // precio Y costo salen del SaleItem resuelto en el servidor, nunca
            // del cliente. El costo queda como snapshot para revertir COGS.
            create: resolved.map(r => ({
              product_id:        r.product_id,
              qty:               r.qty,
              price_usd:         r.price_usd,
              total_usd:         r2(r.qty * r.price_usd),
              sale_item_id:      r.sale_item_id,
              cost_per_unit_usd: r.cost_per_unit_usd,
            })),
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
