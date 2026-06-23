import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import { generateTicketNumber } from '@/lib/ticket'

type Context = { params: { id: string } }

const cobrarSchema = z.object({
  payment_method_id: z.number().int().positive(),
  reference:         z.string().max(100).optional(),
})

/* ── POST /api/orders/[id]/cobrar — convert Order to a paid Sale ── */

export async function POST(req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orderId = Number(params.id)
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  let body: z.infer<typeof cobrarSchema>
  try {
    body = cobrarSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Se requiere método de pago' }, { status: 400 })
  }

  // Validate payment method belongs to this business
  const pm = await prisma.paymentMethod.findFirst({
    where: { id: body.payment_method_id, business_id: session.businessId, is_active: true },
    select: { id: true },
  })
  if (!pm) return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 })

  // Network call must be outside the transaction
  const rate = await getBcvRate()

  try {
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
                  price_per_unit_usd: true, price_per_kg_usd: true },
      })
      const productMap = new Map(products.map(p => [p.id, p]))

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
          origin:        'pos',
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

      // Inventory deduction
      const deductions = order.items.map(item => ({
        business_id: session.businessId,
        product_id:  item.product_id,
        quantity:    -Number(item.quantity),
        waste:       0,
        notes:       `VENTA #${ticket_number} (pedido ${order.order_number})`,
        created_by:  session.userId,
      }))
      if (deductions.length > 0) {
        await tx.inventoryEntry.createMany({ data: deductions })
      }

      await tx.order.update({
        where: { id: orderId },
        data:  { sale_id: newSale.id, status: 'delivered' },
      })

      return { saleId: newSale.id }
    })

    return NextResponse.json({ ok: true, sale_id: saleId })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'ORDER_NOT_FOUND') return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
      if (err.message === 'ALREADY_COBRADO') return NextResponse.json({ error: 'Este pedido ya fue cobrado' }, { status: 409 })
      if (err.message === 'ORDER_TERMINAL')  return NextResponse.json({ error: 'El pedido ya está entregado o cancelado' }, { status: 422 })
    }
    console.error('cobrar POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
