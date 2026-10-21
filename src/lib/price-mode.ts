import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { PRICE_MODES, VARIANT_PRICING_SELECT, resolveLinePrice } from '@/lib/pricing'
import type { PriceMode, PriceSource } from '@/lib/pricing'

/**
 * Cambio del modo de precio (bcv | divisa) de un ticket ABIERTO: venta (draft / pending / quote) o pedido sin cobrar.
 * Recalcula todas las líneas y el total desde la base de datos (nunca desde el cliente); las líneas con precio manual
 * se respetan. El stock no se toca: solo descuenta al pasar a 'paid'. Contrato: .doc/CONTRATO_PRECIO_DIVISA.md.
 */

export const priceModeSchema = z.enum(PRICE_MODES as unknown as [PriceMode, ...PriceMode[]])
export const priceModeBodySchema = z.object({ price_mode: priceModeSchema }).strict()

export class PriceModeError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

export interface RepricedLine {
  id:                 number
  product_id:         number
  variant_id:         number | null
  product_name:       string
  quantity:           number
  price_per_unit_usd: number
  price_source:       PriceSource
  discount_usd:       number
  subtotal_usd:       number
  subtotal_bs:        number
}

export interface RepricedTicket {
  kind:           'sale' | 'order'
  id:             number
  number:         string
  status:         string
  price_mode:     PriceMode
  rate:           number
  total_usd:      number
  total_bs:       number
  fallback_lines: number
  items:          RepricedLine[]
}

const OPEN_SALE_STATUSES: readonly string[] = ['draft', 'pending', 'quote']

const PRODUCT_PRICING_SELECT = {
  id: true, sale_mode: true,
  price_per_unit_usd: true, price_per_kg_usd: true,
  wholesale_price_usd: true, wholesale_price_per_kg_usd: true,
} as const

const r2 = (n: number): number => Math.round(n * 100) / 100

function ticketOf(
  base: Pick<RepricedTicket, 'kind' | 'id' | 'number' | 'status' | 'price_mode' | 'rate' | 'total_usd' | 'total_bs'>,
  items: RepricedLine[],
): RepricedTicket {
  return { ...base, fallback_lines: items.filter(i => i.price_source === 'fallback_bcv').length, items }
}

/** Venta abierta: draft (pestaña del POS), pending o quote. `business_id` siempre el de la sesión. */
export async function repriceSaleTx(
  tx: Prisma.TransactionClient,
  actor: { businessId: number; userId: number; role: string },
  saleId: number,
  mode: PriceMode,
  rate: number,
): Promise<RepricedTicket> {
  const sale = await tx.sale.findFirst({
    where:   { id: saleId, business_id: actor.businessId },
    include: {
      items: {
        include: {
          product: { select: PRODUCT_PRICING_SELECT },
          variant: { select: VARIANT_PRICING_SELECT },
        },
      },
    },
  })
  // La pestaña (draft) es del cajero que la abrió: otro cajero no la ve.
  if (!sale || (sale.status === 'draft' && actor.role === 'cashier' && sale.cashier_id !== actor.userId)) {
    throw new PriceModeError(404, 'Venta no encontrada')
  }
  if (!OPEN_SALE_STATUSES.includes(sale.status)) {
    throw new PriceModeError(
      409,
      sale.status === 'paid'
        ? 'Esta venta ya fue cobrada; no se puede cambiar el modo de precio.'
        : `Esta venta está en estado "${sale.status}"; no se puede cambiar el modo de precio.`,
    )
  }

  const lines: RepricedLine[] = []
  for (const item of sale.items) {
    const { price, source } = resolveLinePrice(item.product, item.variant ?? undefined, {
      mode,
      saleMode:    item.product.sale_mode,
      manualPrice: item.unit_price_override != null ? Number(item.unit_price_override) : null,
    })
    if (price <= 0) throw new PriceModeError(422, `Precio no configurado para "${item.product_name}"`)
    const quantity     = Number(item.quantity)
    const discount     = Number(item.discount_usd)
    const subtotal_usd = r2(Math.max(0, quantity * price - discount))
    const subtotal_bs  = r2(subtotal_usd * rate)
    await tx.saleItem.update({
      where: { id: item.id },
      data:  { price_per_unit_usd: price, subtotal_usd, subtotal_bs, rate_used: rate, price_source: source },
    })
    lines.push({
      id: item.id, product_id: item.product_id, variant_id: item.variant_id, product_name: item.product_name,
      quantity, price_per_unit_usd: price, price_source: source, discount_usd: discount, subtotal_usd, subtotal_bs,
    })
  }

  const total_usd = r2(lines.reduce((acc, l) => acc + l.subtotal_usd, 0))
  const total_bs  = r2(total_usd * rate)
  await tx.sale.update({
    where: { id: sale.id },
    data:  { price_mode: mode, total_usd, total_bs, rate_used: rate },
  })
  return ticketOf(
    { kind: 'sale', id: sale.id, number: sale.ticket_number, status: sale.status, price_mode: mode, rate, total_usd, total_bs },
    lines,
  )
}

/** Pedido sin cobrar (incluye los del catálogo web). `delivery_fee` se suma al total y no depende del modo. */
export async function repriceOrderTx(
  tx: Prisma.TransactionClient,
  businessId: number,
  orderId: number,
  mode: PriceMode,
  rate: number,
): Promise<RepricedTicket> {
  const order = await tx.order.findFirst({
    where:   { id: orderId, business_id: businessId },
    include: { items: true },
  })
  if (!order) throw new PriceModeError(404, 'Pedido no encontrado')
  if (order.sale_id !== null) throw new PriceModeError(409, 'Este pedido ya fue cobrado; no se puede cambiar el modo de precio.')
  if (order.status === 'cancelled') throw new PriceModeError(409, 'Este pedido está cancelado; no se puede cambiar el modo de precio.')
  if (order.status === 'delivered') throw new PriceModeError(409, 'Este pedido ya fue entregado; no se puede cambiar el modo de precio.')

  const products = await tx.product.findMany({
    where:  { id: { in: Array.from(new Set(order.items.map(i => i.product_id))) }, business_id: businessId },
    select: PRODUCT_PRICING_SELECT,
  })
  const productMap = new Map(products.map(p => [p.id, p]))
  const variantIds = order.items.map(i => i.variant_id).filter((v): v is number => v !== null)
  const variants = variantIds.length > 0
    ? await tx.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, ...VARIANT_PRICING_SELECT } })
    : []
  const variantMap = new Map(variants.map(v => [v.id, v]))

  const lines: RepricedLine[] = []
  for (const item of order.items) {
    const product  = productMap.get(item.product_id)
    const quantity = Number(item.quantity)
    // Producto borrado desde que se creó el pedido: la línea conserva su precio y origen (igual que cobrar).
    const { price, source } = product
      ? resolveLinePrice(product, item.variant_id !== null ? variantMap.get(item.variant_id) : undefined, {
          mode,
          saleMode:    product.sale_mode,
          manualPrice: item.price_source === 'manual' ? Number(item.price_per_unit_usd) : null,
        })
      : { price: Number(item.price_per_unit_usd), source: (item.price_source ?? 'bcv') as PriceSource }
    if (price <= 0) throw new PriceModeError(422, `Precio no configurado para "${item.product_name}"`)
    const subtotal_usd = r2(quantity * price)
    await tx.orderItem.update({
      where: { id: item.id },
      data:  { price_per_unit_usd: price, subtotal_usd, price_source: source },
    })
    lines.push({
      id: item.id, product_id: item.product_id, variant_id: item.variant_id, product_name: item.product_name,
      quantity, price_per_unit_usd: price, price_source: source, discount_usd: 0, subtotal_usd, subtotal_bs: r2(subtotal_usd * rate),
    })
  }

  const total_usd = r2(lines.reduce((acc, l) => acc + l.subtotal_usd, 0) + Number(order.delivery_fee))
  const total_bs  = r2(total_usd * rate)
  await tx.order.update({
    where: { id: order.id },
    data:  { price_mode: mode, total_usd, total_bs, rate_used: rate },
  })
  return ticketOf(
    { kind: 'order', id: order.id, number: order.order_number, status: order.status, price_mode: mode, rate, total_usd, total_bs },
    lines,
  )
}
