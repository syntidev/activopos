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
  price_usd:         Numeric
  precio_extra:      Numeric
  /** Precio Divisa propio de la variante (nulo = ver variantBases). */
  divisa_price_usd?: Numeric
}

export type PriceTier = 'detal' | 'mayorista'

/** Campos de ProductVariant que resolveUnitPriceUsd / variantBases necesitan (usar en `select`). */
export const VARIANT_PRICING_SELECT = { price_usd: true, precio_extra: true, divisa_price_usd: true } as const

/** Modo de precio del ticket: lo decide el ticket (no el tier del cliente). 'divisa' = wholesale_price_*. */
export type PriceMode = 'bcv' | 'divisa'
/** Origen del precio realmente aplicado a una línea. */
export type PriceSource = 'bcv' | 'divisa' | 'manual' | 'fallback_bcv'

export const PRICE_MODES: readonly PriceMode[] = ['bcv', 'divisa']

/** Modo explícito del ticket gana; sin él (clientes viejos) el tier mayorista sigue valiendo como 'divisa'. */
export function resolveEffectiveMode(explicit: PriceMode | undefined, tier: PriceTier = 'detal'): PriceMode {
  return explicit ?? (tier === 'mayorista' ? 'divisa' : 'bcv')
}

/** Precios unitarios completos de una línea (precio_extra ya incluido): Full (bcv) y Divisa (null = sin precio Divisa). */
export interface LineBases { bcv: number; divisa: number | null }

/**
 * Bases de precio de una línea — fuente ÚNICA para el servidor (resolveLinePrice) y el cliente (POS, lib/pos.ts).
 *   bcv    = variante con Full propio (price_usd, absoluto) | Full del producto + precio_extra.
 *   divisa = Divisa propio de la variante (divisa_price_usd)
 *            | si la variante NO tiene Full propio: Divisa del producto (per_kg si es por peso) + precio_extra, o null si el producto no lo tiene
 *            | null (Full propio sin Divisa propio: no hay Divisa que derivar).
 * Sin variante: las bases del producto.
 */
export function variantBases(
  product:  PricingProduct,
  variant:  PricingVariant | undefined,
  saleMode: string = 'unit',
): LineBases {
  const extra = Number(variant?.precio_extra ?? 0)
  const bcv = variant?.price_usd != null
    ? Number(variant.price_usd)
    : Number(product.price_per_unit_usd ?? product.price_per_kg_usd ?? 0) + extra

  if (variant?.divisa_price_usd != null) return { bcv, divisa: Number(variant.divisa_price_usd) }
  if (variant?.price_usd != null) return { bcv, divisa: null }
  const wholesale = Number((saleMode === 'weight' ? product.wholesale_price_per_kg_usd : product.wholesale_price_usd) ?? 0)
  return { bcv, divisa: wholesale > 0 ? wholesale + extra : null }
}

/** Elige el precio de las bases según el modo del ticket. Divisa sin precio Divisa (> 0) cae al Full y SIEMPRE queda marcado 'fallback_bcv'. */
export function priceForMode(bases: LineBases, mode: PriceMode): { price: number; source: PriceSource } {
  if (mode === 'divisa' && bases.divisa != null && bases.divisa > 0) return { price: bases.divisa, source: 'divisa' }
  return { price: bases.bcv, source: mode === 'divisa' ? 'fallback_bcv' : 'bcv' }
}

/**
 * Precio unitario de UNA línea según el modo del ticket y su origen.
 *   manual → se respeta siempre; si no, variantBases + priceForMode (bcv → Full; divisa → Divisa, o Full marcado 'fallback_bcv').
 */
export function resolveLinePrice(
  product:  PricingProduct,
  variant:  PricingVariant | undefined,
  opts:     { mode: PriceMode; saleMode?: string; manualPrice?: number | null },
): { price: number; source: PriceSource } {
  if (opts.manualPrice != null) return { price: opts.manualPrice, source: 'manual' }
  return priceForMode(variantBases(product, variant, opts.saleMode ?? 'unit'), opts.mode)
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
