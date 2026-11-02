import type { SaleMode } from '@/types/products'
import type { TicketFinancing } from '@/types/financing'
import { priceForMode, variantBases, type PricingVariant } from '@/lib/pricing'

// ── Shared types ──────────────────────────────────────────────────────────────

export type ClientPriceTier = 'detal' | 'mayorista'

/** Modo de precio del ticket (contrato .doc/CONTRATO_PRECIO_DIVISA.md): bcv = precio de venta en Bs, divisa = dólar directo. */
export type PriceMode = 'bcv' | 'divisa'
/** Origen del precio de una línea; 'fallback_bcv' = se pidió Divisa pero el producto no tiene precio Divisa. */
export type PriceSource = 'bcv' | 'divisa' | 'manual' | 'fallback_bcv'

export interface ProductForPOS {
  id: number
  name: string
  sale_mode: SaleMode
  base_unit_label: string
  price_per_unit_usd: number | null
  price_per_kg_usd: number | null
  wholesale_price_usd?: number | null
  wholesale_price_per_kg_usd?: number | null
  cost_per_unit_usd: number | null
  image_path: string | null
  is_favorite: boolean
  has_variants?: boolean
  /** Talla escaneada (EAN de variante): el POS la agrega directo sin abrir el selector. */
  matched_variant_id?: number | null
  /** price_usd = Full propio de la talla; divisa_price_usd = Divisa propio (ambos nulos = usa el del producto). */
  variants?: Array<{ id: number; valor: string; precio_extra: number; price_usd?: number | null; divisa_price_usd?: number | null; stock: number }>
  stock: { net_qty: number }
}

/** Lo que hace falta de un producto para repreciar una línea: precios y tallas con su precio extra. */
export type ProductPrices = Pick<ProductForPOS, 'id' | 'sale_mode' | 'price_per_unit_usd' | 'price_per_kg_usd' | 'wholesale_price_usd' | 'wholesale_price_per_kg_usd' | 'variants'>

export interface ClientForPOS {
  id: number
  name: string
  phone: string | null
  cedula: string | null
  price_tier?: ClientPriceTier
}

export interface PaymentInput {
  payment_method_id: number
  amount_bs: number
  amount_usd: number
  reference?: string
}

export interface QuoteOptions {
  notes?: string
}

export interface SaleResult {
  id: number
  ticket_number: string
  status: 'quote' | 'pending' | 'paid' | 'credit'
  total_usd: number
  total_bs: number
  price_mode?: PriceMode
}

// ── Ticket ────────────────────────────────────────────────────────────────────

export interface TicketItem {
  product_id: number
  product_name: string
  sale_mode: SaleMode
  unit_label: string
  quantity: number
  price_per_unit_usd: number
  cost_per_unit_usd: number
  subtotal_usd: number   // qty × price (antes de descuento por ítem)
  subtotal_bs: number
  rate_used: number
  discount_usd: number
  /** Talla de la línea; null y ausente significan lo mismo (sin talla). Ver lineKey / sameLine. */
  variant_id?: number | null
  variant_label?: string
  precio_extra_usd: number
  price_override_original?: number  // original price before manual override
  override_reason?: string
  /** Origen del precio aplicado (la línea con precio manual no cambia al cambiar el modo). */
  price_source?: PriceSource
  /** Precios base de la línea (precio_extra de la variante YA incluido, ver variantBases) para repricing instantáneo; ausentes en líneas restauradas de un borrador. */
  bcv_unit_usd?: number
  divisa_unit_usd?: number | null
}

export interface TicketState {
  items: TicketItem[]
  client_id: number | null
  client_name: string
  client_phone: string
  /** Cédula del cliente elegido (precarga del cobro); el cajero puede corregirla al cobrar. */
  client_cedula?: string
  // Tier del cliente asociado — 'mayorista' aplica wholesale_price al agregar
  // ítems. undefined/'detal' = precio de detal (comportamiento por defecto).
  // ponytail: el componente POS (CLI-B) debe setear esto al seleccionar un
  // cliente mayorista; sin ese wiring el carrito muestra detal, pero el SERVER
  // (sales/route.ts) ya cobra mayorista de forma autoritativa por su cuenta.
  client_price_tier?: ClientPriceTier
  /** Modo de precio del ticket; el servidor lo recibe siempre explícito (el tier del cliente ya no decide el precio). */
  price_mode: PriceMode
  /** Cashea declarado en el ticket (null/undefined = no usa financiamiento). */
  financing?: TicketFinancing | null
  notes: string
  discount_global_pct: number
  cargo_global_pct: number
  iva_pct: number
  status: 'open' | 'quote' | 'credit'
  rate: number
}

export interface TicketTotals {
  subtotal_usd: number   // items neto (post item-discount, pre global)
  discount_usd: number   // monto del descuento global
  cargo_usd: number      // monto del cargo global
  iva_usd: number        // IVA (0 si iva_pct = 0)
  total_usd: number
  total_bs: number
}

// Tipo interno para la conversión al payload de la API de ventas
interface SaleApiItem {
  product_id:           number
  quantity:             number
  price_per_unit_usd:   number
  sale_mode:            SaleMode
  discount_usd:         number
  variant_id?:          number
  unit_price_override?: number
  override_reason?:     string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100
const round4 = (n: number) => Math.round(n * 10000) / 10000

/** Variante tal como llega al POS (selector, búsqueda/escaneo) → forma que entiende variantBases (misma regla que el servidor). */
const pricingVariant = (v: { precio_extra: number; price_usd?: number | null; divisa_price_usd?: number | null }): PricingVariant => ({
  precio_extra: v.precio_extra, price_usd: v.price_usd ?? null, divisa_price_usd: v.divisa_price_usd ?? null,
})

// ── Cálculos puros ────────────────────────────────────────────────────────────

export const calcularSubtotalItem = (
  qty: number,
  price: number,
  rate: number
): { usd: number; bs: number } => {
  const usd = round4(qty * price)
  return { usd, bs: round2(usd * rate) }
}

export const calcularTotales = (ticket: TicketState): TicketTotals => {
  const subtotal_usd = round2(
    ticket.items.reduce((s, i) => s + i.subtotal_usd - i.discount_usd, 0)
  )
  const discount_usd  = round2(subtotal_usd * (ticket.discount_global_pct / 100))
  const after_discount = round2(subtotal_usd - discount_usd)
  const cargo_usd     = round2(after_discount * (ticket.cargo_global_pct / 100))
  const net_usd       = round2(after_discount + cargo_usd)
  const iva_usd       = round2(net_usd * ((ticket.iva_pct ?? 0) / 100))
  const total_usd     = round2(net_usd + iva_usd)
  return {
    subtotal_usd,
    discount_usd,
    cargo_usd,
    iva_usd,
    total_usd,
    total_bs: round2(total_usd * ticket.rate),
  }
}

// ── Identidad de línea ────────────────────────────────────────────────────────

/** Variante de una línea, normalizada: null y undefined (sin talla) son lo mismo. */
type VariantRef = number | null | undefined

/** Clave ÚNICA de una línea del ticket: producto + talla (0 = sin talla). Para React keys y comparaciones. */
export const lineKey = (productId: number, variantId: VariantRef): string => `${productId}-${variantId ?? 0}`

/** ¿La línea `i` es la del producto y la talla indicados? */
export const sameLine = (i: { product_id: number; variant_id?: number | null }, productId: number, variantId: VariantRef): boolean =>
  lineKey(i.product_id, i.variant_id) === lineKey(productId, variantId)

// ── Mutaciones del ticket (todas retornan nuevo estado) ────────────────────────

export const agregarItem = (
  ticket: TicketState,
  product: ProductForPOS,
  qty: number
): TicketState => {
  if (product.has_variants) return ticket  // caller must use agregarItemConVariante

  const existing = ticket.items.find(i => sameLine(i, product.id, null))
  if (existing) return updateLineQty(ticket, product.id, null, existing.quantity + qty)

  const base = variantBases(product, undefined, product.sale_mode)
  const { price, source } = priceForMode(base, ticket.price_mode)
  const { usd, bs } = calcularSubtotalItem(qty, price, ticket.rate)
  const item: TicketItem = {
    price_source:     source,
    bcv_unit_usd:     base.bcv,
    divisa_unit_usd:  base.divisa,
    product_id:       product.id,
    product_name:     product.name,
    sale_mode:        product.sale_mode,
    unit_label:       product.base_unit_label,
    quantity:         qty,
    price_per_unit_usd: price,
    cost_per_unit_usd:  product.cost_per_unit_usd ?? 0,
    subtotal_usd: usd,
    subtotal_bs:  bs,
    rate_used:    ticket.rate,
    discount_usd: 0,
    precio_extra_usd: 0,
  }
  return { ...ticket, items: [...ticket.items, item] }
}

export const agregarItemConVariante = (
  ticket: TicketState,
  product: ProductForPOS,
  variant: { id: number; name: string; price_extra_usd: number; price_usd?: number | null; divisa_price_usd?: number | null },
  qty = 1
): TicketState => {
  const existing = ticket.items.find(i => sameLine(i, product.id, variant.id))
  if (existing) return updateLineQty(ticket, product.id, variant.id, existing.quantity + qty)

  // Las bases ya traen el precio_extra de la talla (o su Full/Divisa propio): no se suma nada aparte.
  const base       = variantBases(product, pricingVariant({ precio_extra: variant.price_extra_usd, price_usd: variant.price_usd, divisa_price_usd: variant.divisa_price_usd }), product.sale_mode)
  const resolved   = priceForMode(base, ticket.price_mode)
  const totalPrice = resolved.price
  const { usd, bs } = calcularSubtotalItem(qty, totalPrice, ticket.rate)

  const item: TicketItem = {
    price_source:     resolved.source,
    bcv_unit_usd:     base.bcv,
    divisa_unit_usd:  base.divisa,
    product_id:       product.id,
    product_name:     product.name,
    sale_mode:        product.sale_mode,
    unit_label:       product.base_unit_label,
    quantity:         qty,
    price_per_unit_usd: totalPrice,
    cost_per_unit_usd:  product.cost_per_unit_usd ?? 0,
    subtotal_usd: usd,
    subtotal_bs:  bs,
    rate_used:    ticket.rate,
    discount_usd: 0,
    variant_id:   variant.id,
    variant_label: variant.name,
    precio_extra_usd: variant.price_extra_usd,
  }
  return { ...ticket, items: [...ticket.items, item] }
}

/** Cambia la cantidad de UNA línea (producto + talla). qty <= 0 elimina solo esa línea. */
export const updateLineQty = (
  ticket: TicketState,
  productId: number,
  variantId: VariantRef,
  qty: number
): TicketState => {
  if (qty <= 0) return removeLine(ticket, productId, variantId)
  const items = ticket.items.map(i => {
    if (!sameLine(i, productId, variantId)) return i
    const { usd, bs } = calcularSubtotalItem(qty, i.price_per_unit_usd, ticket.rate)
    return { ...i, quantity: qty, subtotal_usd: usd, subtotal_bs: bs }
  })
  return { ...ticket, items }
}

/** Elimina SOLO la línea indicada (producto + talla). */
export const removeLine = (ticket: TicketState, productId: number, variantId: VariantRef): TicketState => ({
  ...ticket,
  items: ticket.items.filter(i => !sameLine(i, productId, variantId)),
})

export const aplicarDescuentoGlobal = (ticket: TicketState, pct: number): TicketState => ({
  ...ticket,
  discount_global_pct: Math.max(0, Math.min(99.99, pct)),
})

export const aplicarCargoGlobal = (ticket: TicketState, pct: number): TicketState => ({
  ...ticket,
  cargo_global_pct: Math.max(0, pct),
})

export const limpiarTicket = (rate: number, ivaPct = 0): TicketState => ({
  items: [],
  client_id: null,
  client_name: '',
  client_phone: '',
  notes: '',
  discount_global_pct: 0,
  cargo_global_pct: 0,
  iva_pct: ivaPct,
  status: 'open',
  price_mode: 'bcv',
  rate,
})

export const ticketVacio = (ticket: TicketState): boolean => ticket.items.length === 0

export const overridePrecioItem = (
  ticket: TicketState,
  productId: number,
  variantId: VariantRef,
  newPrice: number,
  reason?: string
): TicketState => {
  const items = ticket.items.map(i => {
    if (!sameLine(i, productId, variantId)) return i
    const { usd, bs } = calcularSubtotalItem(i.quantity, newPrice, ticket.rate)
    return {
      ...i,
      price_override_original: i.price_override_original ?? i.price_per_unit_usd,
      override_reason:         reason,
      price_source:            'manual' as const,
      price_per_unit_usd:      newPrice,
      subtotal_usd:            usd,
      subtotal_bs:             bs,
    }
  })
  return { ...ticket, items }
}

// ── Modo de precio ────────────────────────────────────────────────────────────

/**
 * Cambia el modo del ticket y reprecia al instante las líneas cuyo precio base se conoce.
 * Las líneas con precio manual no cambian; los descuentos por línea (montos absolutos) se conservan sin pasar del subtotal.
 */
export const cambiarModoPrecio = (ticket: TicketState, mode: PriceMode): TicketState => {
  const items = ticket.items.map((i): TicketItem => {
    if (i.price_override_original != null || i.price_source === 'manual' || i.bcv_unit_usd === undefined) return i
    const { price: unit, source } = priceForMode({ bcv: i.bcv_unit_usd, divisa: i.divisa_unit_usd ?? null }, mode)
    const { usd, bs } = calcularSubtotalItem(i.quantity, unit, ticket.rate)
    return { ...i, price_per_unit_usd: unit, price_source: source, subtotal_usd: usd, subtotal_bs: bs, discount_usd: Math.min(i.discount_usd, usd) }
  })
  return { ...ticket, price_mode: mode, items }
}

/**
 * Las líneas restauradas de un borrador llegan sin precios base. Con el producto (consultado por id) se completan
 * (sin tocar el precio actual) para que cambiar de modo las reprecie al instante, igual que las líneas nuevas.
 */
export const hidratarPreciosBase = (ticket: TicketState, product: ProductPrices): TicketState => {
  const items = ticket.items.map((i): TicketItem => {
    if (i.product_id !== product.id || i.bcv_unit_usd !== undefined) return i
    const variant = product.variants?.find(v => v.id === i.variant_id)
    // Talla que ya no está activa: no se puede repreciar en el cliente (el servidor sigue siendo la autoridad).
    if (i.variant_id != null && !variant) return i
    const base = variantBases(product, variant ? pricingVariant(variant) : undefined, product.sale_mode)
    return {
      ...i,
      bcv_unit_usd:     base.bcv,
      divisa_unit_usd:  base.divisa,
      precio_extra_usd: variant ? Number(variant.precio_extra ?? 0) : i.precio_extra_usd,
      variant_label:    i.variant_label || variant?.valor,
    }
  })
  return { ...ticket, items }
}

/** Línea del `ticket` que devuelven PATCH /api/sales|orders/{id}/price-mode (sin costos). */
export interface ServerPricedLine {
  product_id:         number
  variant_id:         number | null
  price_per_unit_usd: number
  price_source:       PriceSource
  discount_usd:       number
  subtotal_usd:       number
}

/** Aplica los precios autoritativos del servidor a las líneas del ticket local (mismo producto + variante). */
export const aplicarPreciosServidor = (
  ticket: TicketState,
  mode: PriceMode,
  lines: ReadonlyArray<ServerPricedLine>,
): TicketState => {
  const items = ticket.items.map((i): TicketItem => {
    const hit = lines.find(l => sameLine(i, l.product_id, l.variant_id))
    if (!hit) return i
    const unit = Number(hit.price_per_unit_usd)
    const { usd, bs } = calcularSubtotalItem(i.quantity, unit, ticket.rate)
    return { ...i, price_per_unit_usd: unit, price_source: hit.price_source, subtotal_usd: usd, subtotal_bs: bs }
  })
  return { ...ticket, price_mode: mode, items }
}

// ── Conversión al payload de la API ───────────────────────────────────────────

export const buildSalePayload = (
  ticket: TicketState,
  totals: TicketTotals
): SaleApiItem[] => {
  const baseNet = ticket.items.reduce((s, i) => s + i.subtotal_usd - i.discount_usd, 0)
  const count = ticket.items.length

  return ticket.items.map(i => {
    const itemNet = i.subtotal_usd - i.discount_usd
    const share = baseNet > 0 ? itemNet / baseNet : 1 / count
    const extraDiscount = round4(totals.discount_usd * share)
    return {
      product_id:          i.product_id,
      quantity:            i.quantity,
      price_per_unit_usd:  i.price_per_unit_usd,
      sale_mode:           i.sale_mode,
      discount_usd:        round4(Math.max(0, i.discount_usd + extraDiscount)),
      ...(i.variant_id            ? { variant_id:          i.variant_id }          : {}),
      ...(i.price_override_original != null ? { unit_price_override: i.price_per_unit_usd } : {}),
      ...(i.override_reason        ? { override_reason:     i.override_reason }     : {}),
    }
  })
}
