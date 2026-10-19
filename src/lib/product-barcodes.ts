import { prisma } from '@/lib/prisma'

/**
 * Unicidad de códigos de barras DENTRO de un negocio, a nivel de aplicación: la DB solo tiene índices
 * normales (productos y variantes pueden traer duplicados históricos, y ProductVariant no tiene
 * business_id para un @@unique). Un barcode lo usa UN producto o UNA variante, no ambos: así el POS
 * resuelve el escaneo sin ambigüedad.
 */

export interface BarcodeExclusion {
  /** Producto que se está editando (su propio barcode no cuenta como choque). */
  productId?: number
  /** Variante que se está editando. */
  variantId?: number
}

/** Mensaje si el barcode ya lo usa otro producto/variante del negocio; null si está libre. */
export async function findBarcodeConflict(
  businessId: number,
  barcode: string,
  exclude: BarcodeExclusion = {},
): Promise<string | null> {
  const [product, variant] = await Promise.all([
    prisma.product.findFirst({
      where:  { business_id: businessId, barcode, ...(exclude.productId ? { id: { not: exclude.productId } } : {}) },
      select: { name: true },
    }),
    prisma.productVariant.findFirst({
      where:  { barcode, product: { business_id: businessId }, ...(exclude.variantId ? { id: { not: exclude.variantId } } : {}) },
      select: { valor: true, product: { select: { name: true } } },
    }),
  ])
  if (product) return `Ese código de barras ya pertenece al producto "${product.name}".`
  if (variant) return `Ese código de barras ya pertenece a la variante ${variant.valor} de "${variant.product.name}".`
  return null
}
