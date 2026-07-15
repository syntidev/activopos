import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { generateTicketNumber } from '@/lib/ticket'

type Context = { params: { id: string } }

const cobrarSchema = z.object({
  payment_method_id: z.number().int().positive(),
  reference:         z.string().max(100).optional(),
})

// PERMISOS — INTENCIONAL: sin guard de rol. cashier cobra pedidos como admin (es la
// caja del mostrador). No expone costo/utilidad. Sellado en MATRIZ_..._SELLADA.md (#2).

/* ── POST /api/orders/[id]/cobrar — convert Order to a paid Sale ── */

export async function POST(req: NextRequest, { params }: Context) {
  const orderId = Number(params.id)
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  let body: z.infer<typeof cobrarSchema>
  try {
    body = cobrarSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Se requiere método de pago' }, { status: 400 })
  }

  try {
    const { session, db } = await getAuthenticatedTenant()

    // Validar método de pago (fuera del $transaction) → tenant layer
    const pm = await db.paymentMethod.findFirst({
      where: { id: body.payment_method_id, is_active: true }, // business_id inyectado
      select: { id: true },
    })
    if (!pm) return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 })

    // Network call must be outside the transaction
    const { rate } = await getActiveRate(session.businessId)

    // $transaction en prisma base: business_id manual adentro (la extension no se propaga al tx)
    const { saleId } = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, business_id: session.businessId },
        include: { items: true },
      })

      if (!order)                                          throw new Error('ORDER_NOT_FOUND')
      if (order.sale_id !== null)                          throw new Error('ALREADY_COBRADO')
      if (['delivered', 'cancelled'].includes(order.status)) throw new Error('ORDER_TERMINAL')

      const productIds = Array.from(new Set(order.items.map(i => i.product_id)))
      const products   = await tx.product.findMany({
        where:  { id: { in: productIds }, business_id: session.businessId },
        select: { id: true, sale_mode: true, base_unit_label: true,
                  price_per_unit_usd: true, price_per_kg_usd: true, cost_per_unit_usd: true },
      })
      const productMap = new Map(products.map(p => [p.id, p]))
      if (products.length !== productIds.length) throw new Error('PRODUCTS_CHANGED')

      const saleItems = order.items.map(item => {
        const p        = productMap.get(item.product_id)
        // SEC-01: prices from DB — not from order snapshot
        const priceUsd = p
          ? Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
          : Number(item.price_per_unit_usd)
        const subtotal_usd = Math.round(Number(item.quantity) * priceUsd * 100) / 100
        const subtotal_bs  = Math.round(subtotal_usd * rate * 100) / 100
        return {
          product_id:         item.product_id,
          product_name:       item.product_name,
          sale_mode:          p?.sale_mode ?? 'unit',
          unit_label:         p?.base_unit_label ?? 'und',
          quantity:           Number(item.quantity),
          price_per_unit_usd: priceUsd,
          cost_per_unit_usd:  p ? Number(p.cost_per_unit_usd ?? 0) : 0,
          subtotal_usd,
          subtotal_bs,
          rate_used:          rate,
          discount_usd:       0,
          variant_id:         null,
        }
      })

      const total_usd = Math.round(saleItems.reduce((acc, i) => acc + i.subtotal_usd, 0) * 100) / 100
      const total_bs  = Math.round(total_usd * rate * 100) / 100

      const ticket_number = await generateTicketNumber(session.businessId, tx)

      const newSale = await tx.sale.create({
        data: {
          business_id:   session.businessId,
          cashier_id:    session.userId,
          ticket_number,
          status:        'paid',
          origin:        'catalog',
          total_usd,
          total_bs,
          rate_used:     rate,
          client_id:     order.client_id,
          client_name:   order.client_name,
          client_phone:  order.client_phone,
          notes:         order.notes,
          sold_at:       new Date(),
          items:         { create: saleItems },
          payments: {
            create: [{
              payment_method_id: body.payment_method_id,
              amount_bs:         total_bs,
              amount_usd:        total_usd,
              reference:         body.reference ?? null,
              rate_used:         rate,
            }],
          },
        },
        select: { id: true },
      })

      // Stock ya fue descontado como 'reservation' al crear el pedido en catálogo —
      // reclasificar esas entries a 'sale' en vez de volver a descontar (GAP-CATALOGO-1).
      const reservationUpdate = await tx.inventoryEntry.updateMany({
        where: {
          business_id: session.businessId,
          entry_type:  'reservation',
          product_id:  { in: productIds },
          notes:       { endsWith: order.order_number },
        },
        data: {
          entry_type: 'sale',
          notes:      `VENTA #${ticket_number} (pedido ${order.order_number})`,
        },
      })

      if (reservationUpdate.count === 0) {
        // Pedido legacy sin reserva previa — descuenta ahora (comportamiento anterior)
        const deductions = order.items.map(item => ({
          business_id: session.businessId,
          product_id:  item.product_id,
          quantity:    -Number(item.quantity),
          waste:       0,
          entry_type:  'sale',
          notes:       `VENTA #${ticket_number} (pedido ${order.order_number})`,
          created_by:  session.userId,
        }))
        if (deductions.length > 0) {
          await tx.inventoryEntry.createMany({ data: deductions })
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data:  { sale_id: newSale.id, status: 'delivered' },
      })

      return { saleId: newSale.id }
    })

    return NextResponse.json({ ok: true, sale_id: saleId })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof Error) {
      if (err.message === 'ORDER_NOT_FOUND')   return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
      if (err.message === 'ALREADY_COBRADO')   return NextResponse.json({ error: 'Este pedido ya fue cobrado' }, { status: 409 })
      if (err.message === 'ORDER_TERMINAL')    return NextResponse.json({ error: 'El pedido ya está entregado o cancelado' }, { status: 422 })
      if (err.message === 'PRODUCTS_CHANGED')  return NextResponse.json({ error: 'Uno o más productos del pedido ya no están disponibles' }, { status: 422 })
    }
    console.error('cobrar POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
