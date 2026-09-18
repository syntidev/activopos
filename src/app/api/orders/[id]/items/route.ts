import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

type Context = { params: { id: string } }

// Estados en los que el pedido admite editar ítems — deja de ser editable en
// 'dispatched'/'delivered'/'cancelled' o si ya generó una Sale (cobrado).
const EDITABLE_STATUSES = ['received', 'preparing', 'ready']

// PERMISOS — INTENCIONAL: sin guard de rol, igual que el resto de /api/orders.
// Sellado en MATRIZ_ROLES_PERMISOS_SELLADA.md (#2).

const itemSchema = z.object({
  product_id:    z.number().int().positive(),
  product_name:  z.string().min(1).max(120),
  variant_label: z.string().max(100).optional(),
  quantity:      z.number().positive(),
  // price_per_unit_usd NO se acepta del cliente — siempre se recalcula desde la DB
})

const patchSchema = z.object({
  items: z.array(itemSchema).min(1),
})

/* ── PATCH /api/orders/[id]/items — reemplaza los ítems de un pedido activo ── */

export async function PATCH(req: NextRequest, { params }: Context) {
  const orderId = Number(params.id)
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  let data: z.infer<typeof patchSchema>
  try {
    data = patchSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  try {
    const { session } = await getAuthenticatedTenant()

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, business_id: session.businessId },
      })
      if (!order) throw new Error('ORDER_NOT_FOUND')
      if (!EDITABLE_STATUSES.includes(order.status)) throw new Error('ORDER_NOT_EDITABLE')

      // A5-1: precios desde DB — nunca confiar en el cliente (anti price-tampering)
      const productIds = Array.from(new Set(data.items.map((i) => i.product_id)))
      const products = await tx.product.findMany({
        where:  { id: { in: productIds }, business_id: session.businessId, active: true },
        select: { id: true, price_per_unit_usd: true, price_per_kg_usd: true },
      })
      if (products.length !== productIds.length) throw new Error('PRODUCT_NOT_FOUND')
      const productMap = new Map(products.map((p) => [p.id, p]))

      const itemsWithPrices = data.items.map((item) => {
        const product  = productMap.get(item.product_id)!
        const priceUsd = Number(product.price_per_unit_usd ?? product.price_per_kg_usd ?? 0)
        if (priceUsd <= 0) throw new Error('PRICE_NOT_SET')
        const subtotal_usd = Number((item.quantity * priceUsd).toFixed(2))
        return { ...item, price_per_unit_usd: priceUsd, subtotal_usd }
      })

      // GAP-CATALOGO-1: los pedidos de catálogo bloquean stock disponible con
      // una reserva (InventoryEntry entry_type='reservation') creada al crear
      // el pedido (ver catalog/[slug]/order/route.ts). Si se editan ítems sin
      // recalcular esa reserva, queda desincronizada del contenido real: un
      // ítem agregado nunca se descuenta al cobrar, y uno con cantidad
      // aumentada solo bloquea la cantidad vieja. Se recalcula acá — nunca se
      // deja una reserva vieja huérfana ni una cantidad nueva sin bloquear.
      if (order.origin === 'catalog') {
        const [stockAgg, ownReservations] = await Promise.all([
          tx.inventoryEntry.groupBy({
            by:    ['product_id'],
            where: { business_id: session.businessId, product_id: { in: productIds } },
            _sum:  { quantity: true, waste: true },
          }),
          tx.inventoryEntry.findMany({
            where: {
              business_id: session.businessId,
              entry_type:  'reservation',
              notes:       { endsWith: order.order_number },
            },
            select: { product_id: true, quantity: true },
          }),
        ])

        const stockMap = new Map(
          stockAgg.map(s => [s.product_id, Number(s._sum.quantity ?? 0) - Number(s._sum.waste ?? 0)]),
        )
        // La reserva propia de este pedido ya está restada dentro de stockMap
        // (es un InventoryEntry más) — sumarla de vuelta libera lo que este
        // pedido ya tenía apartado antes de chequear si la cantidad NUEVA
        // entra. Sin esto, conservar la misma cantidad de un ítem ya en el
        // pedido se auto-rechazaría por "falta de stock".
        const ownReservedByProduct = new Map<number, number>()
        for (const r of ownReservations) {
          const qty = Math.abs(Number(r.quantity))
          ownReservedByProduct.set(r.product_id, (ownReservedByProduct.get(r.product_id) ?? 0) + qty)
        }

        for (const item of itemsWithPrices) {
          const netStock    = stockMap.get(item.product_id) ?? 0
          const ownReserved = ownReservedByProduct.get(item.product_id) ?? 0
          const availableForThisOrder = netStock + ownReserved
          if (availableForThisOrder < item.quantity) {
            throw new Error(`STOCK_INSUFICIENTE:${item.product_name}`)
          }
        }
      }

      await tx.orderItem.deleteMany({ where: { order_id: orderId } })

      const itemsTotal = itemsWithPrices.reduce((acc, i) => acc + i.subtotal_usd, 0)
      const total_usd   = Number((itemsTotal + Number(order.delivery_fee)).toFixed(2))
      const total_bs    = Number((total_usd * Number(order.rate_used)).toFixed(2))

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          total_usd,
          total_bs,
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

      if (order.origin === 'catalog') {
        // Reemplazo completo de la reserva — no un ajuste incremental. Libera
        // también la de cualquier ítem que se haya quitado en esta edición
        // (si no, queda huérfana bloqueando stock para siempre).
        await tx.inventoryEntry.deleteMany({
          where: {
            business_id: session.businessId,
            entry_type:  'reservation',
            notes:       { endsWith: order.order_number },
          },
        })
        await tx.inventoryEntry.createMany({
          data: itemsWithPrices.map((item) => ({
            business_id: session.businessId,
            product_id:  item.product_id,
            quantity:    -item.quantity,
            waste:       0,
            entry_type:  'reservation',
            notes:       `Reserva pedido catálogo #${order.order_number}`,
            created_by:  session.userId,
          })),
        })
      }

      return updatedOrder
    })

    return NextResponse.json({ ok: true, order: updated })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof Error) {
      if (err.message === 'ORDER_NOT_FOUND')    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
      if (err.message === 'ORDER_NOT_EDITABLE')  return NextResponse.json({ error: 'El pedido ya no admite edición de ítems' }, { status: 409 })
      if (err.message === 'PRODUCT_NOT_FOUND')   return NextResponse.json({ error: 'Uno o más productos no existen o están inactivos' }, { status: 400 })
      if (err.message === 'PRICE_NOT_SET')       return NextResponse.json({ error: 'Uno o más productos no tienen precio configurado' }, { status: 400 })
      if (err.message.startsWith('STOCK_INSUFICIENTE:')) {
        return NextResponse.json(
          { error: `Stock insuficiente: ${err.message.split(':')[1]}` },
          { status: 409 },
        )
      }
    }
    console.error('order items PATCH error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
