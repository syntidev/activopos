// Precio unitario (USD) de un ítem de venta -- fuente única para sales,
// orders/[id]/cobrar, pos/drafts y pos/drafts/[id] (DT-14/DT-15: la regla
// estaba copiada en 4 rutas y 3 perdían precio_extra de la variante).
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
