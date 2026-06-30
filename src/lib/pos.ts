import type { SaleMode } from '@/types/products'

// ── Shared types ──────────────────────────────────────────────────────────────

export interface ProductForPOS {
  id: number
  name: string
  sale_mode: SaleMode
  base_unit_label: string
  price_per_unit_usd: number | null
  price_per_kg_usd: number | null
  cost_per_unit_usd: number | null
  image_path: string | null
  is_favorite: boolean
  has_variants?: boolean
  stock: { net_qty: number }
}

export interface ClientForPOS {
  id: number
  name: string
  phone: string | null
  cedula: string | null
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
  status: 'quote' | 'pending' | 'paid'
  total_usd: number
  total_bs: number
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
}

export interface TicketState {
  items: TicketItem[]
  client_id: number | null
  client_name: string
  client_phone: string
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
  product_id: number
  quantity: number
  price_per_unit_usd: number
  sale_mode: SaleMode
  discount_usd: number
  variant_id?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100
const round4 = (n: number) => Math.round(n * 10000) / 10000

const effectivePrice = (p: ProductForPOS): number =>
  (p.sale_mode === 'weight' ? p.price_per_kg_usd : p.price_per_unit_usd) ?? 0

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

  const price = effectivePrice(product)
  const { usd, bs } = calcularSubtotalItem(qty, price, ticket.rate)
  const item: TicketItem = {
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

  const basePrice  = effectivePrice(product)
  const totalPrice = basePrice + variant.price_extra_usd
  const { usd, bs } = calcularSubtotalItem(qty, totalPrice, ticket.rate)

  const item: TicketItem = {
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
      price_per_unit_usd:      newPrice,
      subtotal_usd:            usd,
      subtotal_bs:             bs,
    }
  })
  return { ...ticket, items }
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
      product_id:        i.product_id,
      quantity:          i.quantity,
      price_per_unit_usd: i.price_per_unit_usd,
      sale_mode:         i.sale_mode,
      discount_usd:      round4(Math.max(0, i.discount_usd + extraDiscount)),
      ...(i.variant_id ? { variant_id: i.variant_id } : {}),
    }
  })
}
