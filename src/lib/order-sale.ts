import type { Prisma } from '@prisma/client'
import { VARIANT_PRICING_SELECT } from '@/lib/pricing'
import { priceModeSchema, repriceOrderTx } from '@/lib/price-mode'

/**
 * Piezas compartidas para convertir un PEDIDO en VENTA (cobrar, cerrar a crédito): líneas con precio de la DB y descuento de stock.
 * Extraídas de /api/orders/[id]/cobrar sin cambiar su contrato. Todas corren DENTRO de un $transaction (prisma base: business_id manual).
 */

type Tx = Prisma.TransactionClient
export type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>
type ProductRow = Prisma.ProductGetPayload<{ select: {
  id: true; sale_mode: true; base_unit_label: true; price_per_unit_usd: true; price_per_kg_usd: true; cost_per_unit_usd: true; product_type: true
  components: { select: { component_id: true; quantity: true; unit_label: true; component: { select: { id: true; name: true } } } }
} }>

export interface OrderSaleLines {
  mode:       'bcv' | 'divisa'
  saleItems:  Prisma.SaleItemUncheckedCreateWithoutSaleInput[]
  total_usd:  number
  total_bs:   number
  productMap: Map<number, ProductRow>
  variantIds: Set<number>
}

/** Reprecia el pedido (SEC-01: precios de la DB) y arma las líneas de la venta. */
export async function buildOrderSaleLines(
  tx: Tx, ctx: { businessId: number; userId: number }, order: OrderWithItems, rate: number, modeOverride?: 'bcv' | 'divisa',
): Promise<OrderSaleLines> {
  const productIds = Array.from(new Set(order.items.map(i => i.product_id)))
  const products = await tx.product.findMany({
    where:  { id: { in: productIds }, business_id: ctx.businessId },
    select: { id: true, sale_mode: true, base_unit_label: true, price_per_unit_usd: true, price_per_kg_usd: true, cost_per_unit_usd: true, product_type: true,
              components: { select: { component_id: true, quantity: true, unit_label: true, component: { select: { id: true, name: true } } } } },
  })
  const productMap = new Map(products.map(p => [p.id, p]))
  if (products.length !== productIds.length) throw new Error('PRODUCTS_CHANGED')

  const wanted = order.items.map(i => i.variant_id).filter((v): v is number => v !== null)
  const variants = wanted.length > 0
    ? await tx.productVariant.findMany({ where: { id: { in: wanted } }, select: { id: true, ...VARIANT_PRICING_SELECT } })
    : []
  const variantIds = new Set(variants.map(v => v.id))

  const mode     = modeOverride ?? priceModeSchema.catch('bcv').parse(order.price_mode)
  const repriced = await repriceOrderTx(tx, ctx, order.id, mode, rate)
  const lineById = new Map(repriced.items.map(l => [l.id, l]))

  const saleItems = order.items.map(item => {
    const p    = productMap.get(item.product_id)
    const line = lineById.get(item.id)
    const priceUsd     = line ? line.price_per_unit_usd : Number(item.price_per_unit_usd)
    const subtotal_usd = Math.round(Number(item.quantity) * priceUsd * 100) / 100
    const subtotal_bs  = Math.round(subtotal_usd * rate * 100) / 100
    const recipe_snapshot =
      p && p.product_type !== 'simple' && p.components.length > 0
        ? JSON.stringify(p.components.map(c => ({ component_id: c.component_id, component_name: c.component.name, quantity: c.quantity, unit_label: c.unit_label })))
        : null
    return {
      product_id:         item.product_id,
      product_name:       item.product_name,
      sale_mode:          p?.sale_mode ?? 'unit',
      unit_label:         p?.base_unit_label ?? 'und',
      quantity:           Number(item.quantity),
      price_per_unit_usd: priceUsd,
      // costo desconocido = NULL (igual que POST /api/sales); con 0 se contaría como ganancia ficticia.
      cost_per_unit_usd:  p && p.cost_per_unit_usd != null ? Number(p.cost_per_unit_usd) : null,
      subtotal_usd,
      subtotal_bs,
      rate_used:          rate,
      discount_usd:       0,
      recipe_snapshot,
      // Variante borrada desde que se creó el pedido: sin fila que referenciar (evita violar el FK de sale_items.variant_id).
      variant_id:         item.variant_id !== null && variantIds.has(item.variant_id) ? item.variant_id : null,
      price_source:       line?.price_source ?? 'bcv',
    }
  })
  const total_usd = Math.round(saleItems.reduce((acc, i) => acc + Number(i.subtotal_usd), 0) * 100) / 100
  const total_bs  = Math.round(total_usd * rate * 100) / 100
  return { mode, saleItems, total_usd, total_bs, productMap, variantIds }
}

/**
 * Stock de un pedido que pasa a venta (paid o credit: el POS descuenta en ambos). Siempre desde los OrderItem reales (GAP-CATALOGO-1):
 * libera cualquier reserva del pedido y crea las deducciones 'sale' (combos: por componente) más el stock de variante.
 */
export async function deductOrderStockTx(
  tx: Tx, ctx: { businessId: number; userId: number }, order: OrderWithItems, lines: OrderSaleLines, ticketNumber: string,
): Promise<void> {
  await tx.inventoryEntry.deleteMany({
    where: { business_id: ctx.businessId, entry_type: 'reservation', notes: { endsWith: order.order_number } },
  })
  const deductions = order.items.flatMap(item => {
    const p = lines.productMap.get(item.product_id)
    if (p && p.product_type !== 'simple' && p.components.length > 0) {
      return p.components.map(comp => ({
        business_id: ctx.businessId, product_id: comp.component_id, quantity: -(Number(item.quantity) * comp.quantity), waste: 0, entry_type: 'sale',
        notes: `VENTA #${ticketNumber} (componente de ${item.product_name}, pedido ${order.order_number})`, created_by: ctx.userId,
      }))
    }
    return [{
      business_id: ctx.businessId, product_id: item.product_id, quantity: -Number(item.quantity), waste: 0, entry_type: 'sale',
      notes: `VENTA #${ticketNumber} (pedido ${order.order_number})`, created_by: ctx.userId,
    }]
  })
  await tx.inventoryEntry.createMany({ data: deductions })

  for (const item of order.items) {
    const p = lines.productMap.get(item.product_id)
    if (item.variant_id === null || !lines.variantIds.has(item.variant_id)) continue
    if (p && p.product_type !== 'simple') continue
    await tx.productVariant.update({ where: { id: item.variant_id }, data: { stock: { decrement: Number(item.quantity) } } })
  }
}
