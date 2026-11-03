import type { SaleMode } from '@/types/products'
import type { ProductForPOS } from '@/lib/pos'
import { priceForMode, variantBases, type PriceMode, type PriceSource } from '@/lib/pricing'

/** Producto tal como lo entregan /api/products, /api/products/recent y /api/products/search. */
export interface ApiPOSProduct {
  id: number
  name: string
  sale_mode: string
  base_unit_label: string
  price_per_unit_usd: number | null
  price_per_kg_usd: number | null
  wholesale_price_usd?: number | null
  wholesale_price_per_kg_usd?: number | null
  cost_per_unit_usd: number | null
  image_path?: string | null
  images?: string[] | null
  is_favorite: boolean
  has_variants?: boolean
  matched_variant_id?: number | null
  variants?: ProductForPOS['variants']
  stock: { net_qty: number }
}

/** ÚNICA normalización de producto del POS (búsqueda, browse, recientes): foto con fallback a images[0] y precios Full + Divisa. */
export function toPOSProduct(p: ApiPOSProduct): ProductForPOS {
  return {
    id:                         p.id,
    name:                       p.name,
    sale_mode:                  p.sale_mode as SaleMode,
    base_unit_label:            p.base_unit_label,
    price_per_unit_usd:         p.price_per_unit_usd,
    price_per_kg_usd:           p.price_per_kg_usd,
    wholesale_price_usd:        p.wholesale_price_usd ?? null,
    wholesale_price_per_kg_usd: p.wholesale_price_per_kg_usd ?? null,
    cost_per_unit_usd:          p.cost_per_unit_usd,
    image_path:                 p.image_path ?? p.images?.[0] ?? null,
    is_favorite:                p.is_favorite,
    has_variants:               p.has_variants ?? false,
    matched_variant_id:         p.matched_variant_id ?? null,
    variants:                   p.variants,
    stock:                      p.stock,
  }
}

/**
 * Precio que muestra la tarjeta / fila / chip del producto ANTES de agregarlo, en el modo del ticket.
 * Misma regla que la línea del ticket y el servidor (lib/pricing.ts); un producto con variantes muestra el precio base del producto.
 * source 'fallback_bcv' = se pidió Divisa y el producto no tiene precio Divisa: se muestra el Full y la UI lo avisa.
 */
export function cardPrice(product: ProductForPOS, mode: PriceMode): { price: number; source: PriceSource } {
  return priceForMode(variantBases(product, undefined, product.sale_mode), mode)
}

/** Aviso de línea sin precio Divisa: el mismo texto que ya usa la línea del ticket (TicketPanel). */
export const NO_DIVISA_LABEL = 'Sin precio Divisa'
export const NO_DIVISA_TITLE = 'Este producto no tiene precio Divisa: se cobra a precio BCV'
