import type { SaleMode } from '@/types/products'
import type { TicketFinancing } from '@/types/financing'

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
  variants?: Array<{ id: number; valor: string; precio_extra: number; stock: number }>
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
  variant_id?: number
  variant_label?: string
  precio_extra_usd: number
  price_override_original?: number  // original price before manual override
  override_reason?: string
  /** Origen del precio aplicado (la línea con precio manual no cambia al cambiar el modo). */
  price_source?: PriceSource
  /** Precios base del producto (sin precio_extra) para repricing instantáneo; ausentes en líneas restauradas de un borrador. */
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

/** Precio base de un producto en el modo del ticket; Divisa sin precio Divisa cae a BCV y lo marca. */
function resolverPrecio(
  bcv: number,
  divisa: number | null,
  mode: PriceMode,
): { price: number; source: PriceSource } {
  if (mode === 'divisa') {
    return divisa != null && divisa > 0
      ? { price: divisa, source: 'divisa' }
      : { price: bcv, source: 'fallback_bcv' }
  }
  return { price: bcv, source: 'bcv' }
}

const preciosBase = (p: ProductPrices): { bcv: number; divisa: number | null } => ({
  bcv:    (p.sale_mode === 'weight' ? p.price_per_kg_usd : p.price_per_unit_usd) ?? 0,
  divisa: (p.sale_mode === 'weight' ? p.wholesale_price_per_kg_usd : p.wholesale_price_usd) ?? null,
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

// ── Mutaciones del ticket (todas retornan nuevo estado) ────────────────────────

export const agregarItem = (
  ticket: TicketState,
  product: ProductForPOS,
  qty: number
): TicketState => {
  if (product.has_variants) return ticket  // caller must use agregarItemConVariante

  const existing = ticket.items.find(i => i.product_id === product.id && !i.variant_id)
  if (existing) return actualizarCantidad(ticket, product.id, existing.quantity + qty)

  const base = preciosBase(product)
  const { price, source } = resolverPrecio(base.bcv, base.divisa, ticket.price_mode)
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
  variant: { id: number; name: string; price_extra_usd: number },
  qty = 1
): TicketState => {
  const existing = ticket.items.find(
    i => i.product_id === product.id && i.variant_id === variant.id
  )
  if (existing) {
    return actualizarCantidadVariante(ticket, product.id, variant.id, existing.quantity + qty)
  }

  const base       = preciosBase(product)
  const resolved   = resolverPrecio(base.bcv, base.divisa, ticket.price_mode)
  const totalPrice = resolved.price + variant.price_extra_usd
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

export const actualizarCantidad = (
  ticket: TicketState,
  productId: number,
  qty: number
): TicketState => {
  if (qty <= 0) return eliminarItem(ticket, productId)
  const items = ticket.items.map(i => {
    if (i.product_id !== productId || i.variant_id) return i
    const { usd, bs } = calcularSubtotalItem(qty, i.price_per_unit_usd, ticket.rate)
    return { ...i, quantity: qty, subtotal_usd: usd, subtotal_bs: bs }
  })
  return { ...ticket, items }
}

const actualizarCantidadVariante = (
  ticket: TicketState,
  productId: number,
  variantId: number,
  qty: number
): TicketState => {
  if (qty <= 0) return eliminarItemVariante(ticket, productId, variantId)
  const items = ticket.items.map(i => {
    if (i.product_id !== productId || i.variant_id !== variantId) return i
    const { usd, bs } = calcularSubtotalItem(qty, i.price_per_unit_usd, ticket.rate)
    return { ...i, quantity: qty, subtotal_usd: usd, subtotal_bs: bs }
  })
  return { ...ticket, items }
}

export const eliminarItem = (ticket: TicketState, productId: number): TicketState => ({
  ...ticket,
  items: ticket.items.filter(i => i.product_id !== productId || i.variant_id !== undefined),
})

const eliminarItemVariante = (
  ticket: TicketState,
  productId: number,
  variantId: number
): TicketState => ({
  ...ticket,
  items: ticket.items.filter(
    i => !(i.product_id === productId && i.variant_id === variantId)
  ),
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
  variantId: number | undefined,
  newPrice: number,
  reason?: string
): TicketState => {
  const items = ticket.items.map(i => {
    if (i.product_id !== productId) return i
    if (variantId !== undefined && i.variant_id !== variantId) return i
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
    const { price, source } = resolverPrecio(i.bcv_unit_usd, i.divisa_unit_usd ?? null, mode)
    const unit = price + i.precio_extra_usd
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
  const base = preciosBase(product)
  const items = ticket.items.map((i): TicketItem => {
    if (i.product_id !== product.id || i.bcv_unit_usd !== undefined) return i
    const variant = product.variants?.find(v => v.id === i.variant_id)
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
    const hit = lines.find(l => l.product_id === i.product_id && (l.variant_id ?? undefined) === i.variant_id)
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
