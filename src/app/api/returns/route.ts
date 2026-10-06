import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import {
  RETURNABLE_SALE_STATUSES,
  computeReturnableLines,
  isFullyReturned,
  type ReturnableSaleStatus,
} from '@/lib/returns'
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
          // Método por el que salió el reembolso: la pantalla lo muestra y
          // distingue si afectó el efectivo (type='cash'). null en devoluciones
          // previas al estándar contable.
          refund_payment_method: { select: { id: true, name: true, type: true } },
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
    // partial_return SÍ acepta más devoluciones: lo que falte de cada línea.
    // Cualquier otro estado (quote/pending/cancelled/credit/draft) no.
    if (!RETURNABLE_SALE_STATUSES.includes(sale.status as ReturnableSaleStatus)) {
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

    // Devolvible por LÍNEA -- misma función que usa /api/sales para decidir qué
    // ofrecer en la pantalla (src/lib/returns.ts). Esta validación es la
    // temprana, "amable": el chequeo que de verdad manda se repite DENTRO de la
    // $transaction con la fila bloqueada, para que dos devoluciones simultáneas
    // no sobredevuelvan.
    // ReturnItem no tiene business_id — se filtra por la relación return.business_id
    const existingReturns = await db.returnItem.findMany({
      where:  { return: { sale_id: body.sale_id, business_id: bid, status: 'approved' } },
      select: { product_id: true, qty: true, sale_item_id: true },
    })

    const saleLines = sale.items.map(si => ({ id: si.id, product_id: si.product_id, quantity: Number(si.quantity) }))
    const returnedRows = existingReturns.map(ri => ({
      sale_item_id: ri.sale_item_id,
      product_id:   ri.product_id,
      qty:          Number(ri.qty),
    }))

    const requestedByLine = new Map<number, number>()
    for (const r of resolved) requestedByLine.set(r.sale_item_id, (requestedByLine.get(r.sale_item_id) ?? 0) + r.qty)

    /** Valida lo pedido contra lo devolvible. Devuelve el error listo, o null. */
    const validateAgainst = (returned: typeof returnedRows) => {
      const returnable = new Map(computeReturnableLines(saleLines, returned).map(l => [l.sale_item_id, l]))
      for (const [lineId, qty] of Array.from(requestedByLine.entries())) {
        const l = returnable.get(lineId)
        if (!l) return { error: 'La línea indicada no pertenece a esta venta', sale_item_id: lineId }
        if (l.ambiguous_legacy_return) {
          return {
            error:        'Hay una devolución anterior sin línea registrada para este producto y está en varias líneas: no se puede determinar qué queda devolvible',
            sale_item_id: lineId,
            product_id:   l.product_id,
          }
        }
        if (qty > l.qty_returnable + 0.001) {
          return {
            error:          'Cantidad a devolver supera lo devolvible de esa línea',
            sale_item_id:   lineId,
            qty_sold:       l.qty_sold,
            qty_returned:   l.qty_returned,
            qty_returnable: l.qty_returnable,
            solicitado:     qty,
          }
        }
      }
      return null
    }

    const earlyError = validateAgainst(returnedRows)
    if (earlyError) return NextResponse.json(earlyError, { status: 422 })

    const rate     = Number(sale.rate_used)
    const r2       = (x: number) => Math.round(x * 100) / 100
    // Por LÍNEA, no por producto: dos líneas del mismo producto pueden tener
    // precios distintos (override), y el total debe usar el de cada línea.
    const totalUsd = r2(resolved.reduce((s, r) => s + r.qty * r.price_usd, 0))

    // $transaction en prisma base: business_id manual adentro
    const result = await prisma.$transaction(async tx => {
      // Bloquea la VENTA: serializa dos devoluciones simultáneas sobre la misma
      // venta. Sin esto, ambas leerían el mismo "devolvible" y sobredevolverían.
      const locked = await tx.$queryRaw<{ id: number; status: string }[]>`
        SELECT id, status FROM sales
        WHERE id = ${body.sale_id} AND business_id = ${bid}
        FOR UPDATE`
      const lockedStatus = locked[0]?.status
      if (!lockedStatus) {
        throw Object.assign(new Error('SALE_GONE'), { code: 'SALE_GONE' })
      }
      if (!RETURNABLE_SALE_STATUSES.includes(lockedStatus as ReturnableSaleStatus)) {
        throw Object.assign(new Error('ALREADY_RETURNED'), { code: 'ALREADY_RETURNED' })
      }

      // Relectura con la fila bloqueada: este es el chequeo que manda.
      const freshReturns = await tx.returnItem.findMany({
        where:  { return: { sale_id: body.sale_id, business_id: bid, status: 'approved' } },
        select: { product_id: true, qty: true, sale_item_id: true },
      })
      const freshRows = freshReturns.map(ri => ({
        sale_item_id: ri.sale_item_id,
        product_id:   ri.product_id,
        qty:          Number(ri.qty),
      }))
      const conflict = validateAgainst(freshRows)
      if (conflict) {
        throw Object.assign(new Error('OVER_RETURN'), { code: 'OVER_RETURN', detail: conflict })
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
        // Una entrada de inventario por línea devuelta, una sola vez por
        // devolución (va dentro de la misma transacción que crea el Return).
        await tx.inventoryEntry.createMany({
          data: resolved.map(r => ({
            business_id: bid,
            product_id:  r.product_id,
            quantity:    r.qty,
            waste:       0,
            entry_type:  'return',
            notes:       `DEVOLUCIÓN #${ret.id}`,
            created_by:  session.userId,
          })),
        })
      }

      // Estado final: `returned` solo si tras ESTA devolución no queda nada
      // devolvible en ninguna línea; si queda algo, `partial_return`.
      const afterRows = [
        ...freshRows,
        ...resolved.map(r => ({ sale_item_id: r.sale_item_id, product_id: r.product_id, qty: r.qty })),
      ]
      const newSaleStatus = isFullyReturned(computeReturnableLines(saleLines, afterRows))
        ? 'returned'
        : 'partial_return'

      await tx.sale.update({
        where: { id: body.sale_id },
        data:  { status: newSaleStatus },
      })

      return ret
    })

    return NextResponse.json({
      ok: true,
      sale: { id: sale.id, ticket_number: sale.ticket_number },
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
    if ((err as { code?: string }).code === 'SALE_GONE') {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    }
    // Otra devolución entró primero y ya consumió lo devolvible (se detectó con
    // la venta bloqueada dentro de la transacción).
    if ((err as { code?: string }).code === 'OVER_RETURN') {
      const detail = (err as { detail?: Record<string, unknown> }).detail ?? {}
      return NextResponse.json(detail, { status: 422 })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('returns POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
