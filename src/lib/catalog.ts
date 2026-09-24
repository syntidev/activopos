import { revalidateTag } from 'next/cache'
import { prisma } from './prisma'
import { PLAN_LIMITS, type PlanTier } from './plan-limits'

export type Availability = 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued'

// El catálogo público solo está vivo si el plan lo incluye y la suscripción está vigente.
// Se revalida en cada lectura — un negocio que baja de plan o cuya suscripción expira
// deja de servir catálogo, aunque catalog_active haya quedado en true.
export function isCatalogLive(business: {
  catalog_plan:            string | null
  subscription_active:     boolean
  subscription_expires_at: Date | null
}): boolean {
  const plan   = (business.catalog_plan as PlanTier | null) ?? 'gratis'
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.gratis
  if (!limits.catalog)            return false
  if (!business.subscription_active) return false
  if (business.subscription_expires_at && new Date() > business.subscription_expires_at) return false
  return true
}

// Un producto es UN producto, tenga variantes o no. Su stock real vive en UN
// solo lugar según su forma: con variantes activas, en product_variants; sin
// ellas, en inventory_entries. `net_stock` (la suma de inventory_entries del
// padre) NO es autoritativo para un producto con variantes -- se queda en 0
// mientras sus tallas tienen unidades reales, y el catálogo lo pinta agotado
// (incidente 2026-09-24: Franelas 200K, 0 en inventory_entries, 60-80
// unidades reales repartidas en 6-8 tallas).
//
// Toda decisión de disponibilidad del catálogo pasa por acá. Nunca leer
// `net_stock` suelto para decidir si un producto está agotado.
export function effectiveStock(product: {
  has_variants?: boolean
  variants?:     { stock: number }[] | null
  net_stock?:    number | null
}): number {
  if (product.has_variants && product.variants?.length) {
    return product.variants.reduce((sum, v) => sum + v.stock, 0)
  }
  return product.net_stock ?? 0
}

export function isOutOfStock(product: {
  sale_mode:     string
  has_variants?: boolean
  variants?:     { stock: number }[] | null
  net_stock?:    number | null
}): boolean {
  if (product.sale_mode === 'service') return false
  return effectiveStock(product) <= 0
}

export function computeAvailability(product: {
  sale_mode:     string
  availability:  string
  net_stock?:    number | null
  min_stock?:    number | null
  has_variants?: boolean
  variants?:     { stock: number }[] | null
}): Availability {
  if (product.availability === 'discontinued') return 'discontinued'
  if (product.sale_mode === 'service')         return 'in_stock'
  const net = effectiveStock(product)
  const min = product.min_stock ?? 0
  if (net <= 0)   return 'out_of_stock'
  if (net <= min) return 'low_stock'
  return 'in_stock'
}

// Única autoridad sobre "¿este producto se ve en el catálogo público?".
//
// `show_in_catalog` era un SEGUNDO flag para la MISMA decisión, y toda la UI
// de admin lo escribe derivado (`show_in_catalog: catalogVisibility !== 'hidden'`,
// ver productos/[id]/editar/page.tsx:228, productos/nuevo/page.tsx:75,
// productos/page.tsx:324). Un producto creado FUERA de esa UI (script, import,
// seed) se quedaba con el default `false` del schema mientras el toggle del
// admin mostraba "Visible": el dueño lo veía visible, el catálogo lo filtraba
// oculto, y no había forma de notarlo desde el panel. Se elimina de toda
// decisión pública -- la columna sigue en DB (la lee el admin), pero ya no
// decide nada acá.
export const CATALOG_WHERE_FILTER = {
  catalog_visibility: { not: 'hidden' as const },
} as const

// Invalida el cache de 60s del catálogo público al editar/crear/borrar un
// producto — sin esto, el dueño vería su cambio recién a los 60s.
export async function revalidateCatalogCache(businessId: number): Promise<void> {
  const business = await prisma.business.findUnique({
    where:  { id: businessId },
    select: { catalog_slug: true },
  })
  if (business?.catalog_slug) revalidateTag(`catalog-${business.catalog_slug}`)
}
