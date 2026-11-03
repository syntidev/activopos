/**
 * Precio Divisa como principal en el catálogo premium (solo presentación).
 * - Precio Divisa del producto = wholesale_price_usd (por unidad) o wholesale_price_per_kg_usd (por kilo); sin valor > 0 → null.
 * - Formas de pago en divisa: business.settings.catalog_divisa_methods = ids de payment_methods activos del negocio
 *   (dato de configuración, sin cambio de esquema). Nada de nombres escritos en el código.
 */

interface DivisaPriced {
  price_per_unit_usd: { toString(): string } | null
  wholesale_price_usd: { toString(): string } | null
  wholesale_price_per_kg_usd: { toString(): string } | null
}

/** Mismo criterio de unidad/kilo que `priceUsd` de las tarjetas: si hay precio por unidad, su Divisa es la de unidad. */
export function divisaPriceOf(p: DivisaPriced): number | null {
  const raw = p.price_per_unit_usd !== null ? p.wholesale_price_usd : p.wholesale_price_per_kg_usd
  const n = raw === null ? 0 : Number(raw.toString())
  return n > 0 ? n : null
}

export function readDivisaMethodIds(settings: unknown): number[] {
  const raw = (settings as Record<string, unknown> | null)?.catalog_divisa_methods
  return Array.isArray(raw) ? raw.filter((v): v is number => Number.isInteger(v) && v > 0) : []
}

/** Reparte los medios de cobro activos: los marcados como divisa vs el resto (Bs: pago móvil, transferencia, Cashea…). */
export function splitPayMethods<T extends { id: number }>(methods: readonly T[], divisaIds: readonly number[]): { divisa: T[]; bs: T[] } {
  const set = new Set(divisaIds)
  return { divisa: methods.filter(m => set.has(m.id)), bs: methods.filter(m => !set.has(m.id)) }
}
