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

export function computeAvailability(product: {
  sale_mode:    string
  availability: string
  net_stock?:   number | null
  min_stock?:   number | null
}): Availability {
  if (product.availability === 'discontinued') return 'discontinued'
  if (product.sale_mode === 'service')         return 'in_stock'
  const net = product.net_stock ?? 0
  const min = product.min_stock ?? 0
  if (net <= 0)   return 'out_of_stock'
  if (net <= min) return 'low_stock'
  return 'in_stock'
}

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
