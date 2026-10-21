// Precio unitario (USD) de un ítem de venta -- fuente única para sales,
// orders/[id]/cobrar, pos/drafts, pos/drafts/[id] y catalog/[slug]/order
// (DT-14/DT-15: la regla estaba copiada en 5 rutas y 3 perdían precio_extra).
//
// Semántica (misma que VariantSelector.tsx en el POS):
//   1. variant.price_usd es override ABSOLUTO -- si existe, gana sin más.
//   2. Si no, base del producto (price_per_unit_usd ?? price_per_kg_usd), o el
//      precio mayorista si el cliente es mayorista y el producto lo tiene > 0
//      para el modo de venta.
//   3. + variant.precio_extra.

// Number() acepta Prisma.Decimal, number o null (null -> 0 vía `?? 0`).
type Numeric = number | { toString(): string } | null | undefined

export interface PricingProduct {
  price_per_unit_usd:          Numeric
  price_per_kg_usd:            Numeric
  wholesale_price_usd?:        Numeric
  wholesale_price_per_kg_usd?: Numeric
}

export interface PricingVariant {
  price_usd:    Numeric
  precio_extra: Numeric
}

export type PriceTier = 'detal' | 'mayorista'

/** Campos de ProductVariant que resolveUnitPriceUsd necesita (usar en `select`). */
export const VARIANT_PRICING_SELECT = { price_usd: true, precio_extra: true } as const

/** Modo de precio del ticket: lo decide el ticket (no el tier del cliente). 'divisa' = wholesale_price_*. */
export type PriceMode = 'bcv' | 'divisa'
/** Origen del precio realmente aplicado a una línea. */
export type PriceSource = 'bcv' | 'divisa' | 'manual' | 'fallback_bcv'

export const PRICE_MODES: readonly PriceMode[] = ['bcv', 'divisa']

/** Modo explícito del ticket gana; sin él (clientes viejos) el tier mayorista sigue valiendo como 'divisa'. */
export function resolveEffectiveMode(explicit: PriceMode | undefined, tier: PriceTier = 'detal'): PriceMode {
  return explicit ?? (tier === 'mayorista' ? 'divisa' : 'bcv')
}

/**
 * Precio unitario de UNA línea según el modo del ticket y su origen.
 *   manual → se respeta siempre; bcv → regla de siempre; divisa → wholesale_price_usd (per_kg si es por peso),
 *   sin precio Divisa (o variante con price_usd propio, que no tiene equivalente) → BCV con origen 'fallback_bcv'.
 */
export function resolveLinePrice(
  product:  PricingProduct,
  variant:  PricingVariant | undefined,
  opts:     { mode: PriceMode; saleMode?: string; manualPrice?: number | null },
): { price: number; source: PriceSource } {
  if (opts.manualPrice != null) return { price: opts.manualPrice, source: 'manual' }
  const saleMode = opts.saleMode ?? 'unit'
  const bcv = resolveUnitPriceUsd(product, variant, 'detal', saleMode)
  if (opts.mode === 'bcv') return { price: bcv, source: 'bcv' }
  if (variant?.price_usd != null) return { price: bcv, source: 'fallback_bcv' }
  const divisa = Number((saleMode === 'weight' ? product.wholesale_price_per_kg_usd : product.wholesale_price_usd) ?? 0)
  if (divisa > 0) return { price: divisa + Number(variant?.precio_extra ?? 0), source: 'divisa' }
  return { price: bcv, source: 'fallback_bcv' }
}

export function resolveUnitPriceUsd(
  product:  PricingProduct,
  variant:  PricingVariant | undefined,
  tier:     PriceTier = 'detal',
  saleMode: string    = 'unit',
): number {
  if (variant?.price_usd != null) return Number(variant.price_usd)

  let base = Number(product.price_per_unit_usd ?? product.price_per_kg_usd ?? 0)
  if (tier === 'mayorista') {
    const wholesale = Number(
      (saleMode === 'weight' ? product.wholesale_price_per_kg_usd : product.wholesale_price_usd) ?? 0,
    )
    if (wholesale > 0) base = wholesale
  }
  return base + Number(variant?.precio_extra ?? 0)
}
