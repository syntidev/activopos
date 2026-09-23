import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { generateTicketNumber } from '@/lib/ticket'
import { resolveUnitPriceUsd, VARIANT_PRICING_SELECT } from '@/lib/pricing'

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
                  price_per_unit_usd: true, price_per_kg_usd: true, cost_per_unit_usd: true,
                  product_type: true,
                  components: {
                    select: {
                      component_id: true, quantity: true, unit_label: true,
                      component: { select: { id: true, name: true } },
                    },
                  } },
      })
      const productMap = new Map(products.map(p => [p.id, p]))
      if (products.length !== productIds.length) throw new Error('PRODUCTS_CHANGED')

      // DT-14: faltaba sumar precio_extra de la variante -- esta ruta
      // recalculaba el precio SOLO desde el producto base, ignorando el
      // variant_id del pedido (que hasta ahora ni se guardaba). Mismo criterio
      // que api/catalog/[slug]/order/route.ts al crear el pedido: precio_extra
      // se re-consulta acá también (no del snapshot), consistente con SEC-01.
      const variantIds = order.items
        .map(i => i.variant_id)
        .filter((v): v is number => v !== null)
      const variants = variantIds.length > 0
        ? await tx.productVariant.findMany({
            where:  { id: { in: variantIds } },
            select: { id: true, ...VARIANT_PRICING_SELECT },
          })
        : []
      const variantMap = new Map(variants.map(v => [v.id, v]))

      const saleItems = order.items.map(item => {
        const p        = productMap.get(item.product_id)
        const variant  = item.variant_id !== null ? variantMap.get(item.variant_id) : undefined
        // SEC-01: prices from DB — not from order snapshot. Regla única en
        // lib/pricing.ts; pedidos de catálogo siempre a precio detal.
        const priceUsd = p
          ? resolveUnitPriceUsd(p, variant)
          : Number(item.price_per_unit_usd)
        const subtotal_usd = Math.round(Number(item.quantity) * priceUsd * 100) / 100
        const subtotal_bs  = Math.round(subtotal_usd * rate * 100) / 100
        // Mismo criterio que sales/route.ts: snapshot inmutable de la receta al
        // momento del cobro, para combos/fabricables (GAP-COMBO-PEDIDOS: esta
        // ruta nunca lo calculaba, quedaba siempre null para pedidos con kits).
        const recipe_snapshot =
          p && p.product_type !== 'simple' && p.components.length > 0
            ? JSON.stringify(
                p.components.map(c => ({
                  component_id:   c.component_id,
                  component_name: c.component.name,
                  quantity:       c.quantity,
                  unit_label:     c.unit_label,
                }))
              )
            : null
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
          recipe_snapshot,
          // Si la variante fue borrada desde que se creó el pedido, no hay fila
          // que referenciar (evita violar el FK de sale_items.variant_id) --
          // mismo criterio permisivo que priceUsd arriba cuando falta el producto.
          variant_id:         variant ? item.variant_id : null,
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

      // Stock: SIEMPRE se descuenta desde los OrderItem reales de este pedido,
      // nunca desde una reserva congelada de la creación (GAP-CATALOGO-1 — la
      // versión anterior reclasificaba reservas por product_id y solo caía al
      // fallback de descuento si NINGUNA reserva matcheaba para todo el
      // pedido; un ítem agregado en una edición posterior, o uno con cantidad
      // cambiada, se colaba sin descontar porque los DEMÁS ítems sí tenían
      // reserva y el count nunca llegaba a 0). Se libera cualquier reserva de
      // este pedido —incluida la de un ítem que se haya quitado en una
      // edición, que si no queda huérfana bloqueando stock para siempre— y se
      // crean las deducciones 'sale' directo desde order.items, sin depender
      // de que la reserva haya quedado sincronizada.
      await tx.inventoryEntry.deleteMany({
        where: {
          business_id: session.businessId,
          entry_type:  'reservation',
          notes:       { endsWith: order.order_number },
        },
      })

      // GAP-COMBO-PEDIDOS: esta ruta descontaba siempre contra item.product_id
      // sin mirar product_type/components -- un pedido con un Kit (combo)
      // nunca tocaba el stock de sus componentes reales, solo el pool del
      // propio combo (que no se usa para nada). Mismo bloque que
      // sales/route.ts POST ya usa para venta directa.
      const deductions = order.items.flatMap(item => {
        const p = productMap.get(item.product_id)
        if (p && p.product_type !== 'simple' && p.components.length > 0) {
          return p.components.map(comp => ({
            business_id: session.businessId,
            product_id:  comp.component_id,
            quantity:    -(Number(item.quantity) * comp.quantity),
            waste:       0,
            entry_type:  'sale',
            notes:       `VENTA #${ticket_number} (componente de ${item.product_name}, pedido ${order.order_number})`,
            created_by:  session.userId,
          }))
        }
        return [{
          business_id: session.businessId,
          product_id:  item.product_id,
          quantity:    -Number(item.quantity),
          waste:       0,
          entry_type:  'sale',
          notes:       `VENTA #${ticket_number} (pedido ${order.order_number})`,
          created_by:  session.userId,
        }]
      })
      await tx.inventoryEntry.createMany({ data: deductions })

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
