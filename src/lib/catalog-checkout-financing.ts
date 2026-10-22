import { prisma } from '@/lib/prisma'
import { isCatalogLive } from '@/lib/catalog'
import { readFinancingConfig, toPublicFinancing } from '@/lib/financing'
import type { PublicFinancing } from '@/lib/financing'

export interface CheckoutFinancingData {
  /** null = el negocio no tiene financiamiento activo: el checkout no ofrece Cashea. */
  financing: PublicFinancing | null
  /** Productos excluidos del financiamiento; el checkout los cruza con el carrito. */
  excludedIds: number[]
}

const NONE: CheckoutFinancingData = { financing: null, excludedIds: [] }
const SLUG_RE = /^[a-z0-9-]{1,60}$/

/** Datos públicos para el selector de pago del checkout (mismo criterio que la ficha: settings.financing). */
export async function loadCheckoutFinancing(slug: string): Promise<CheckoutFinancingData> {
  if (!SLUG_RE.test(slug)) return NONE
  const business = await prisma.business.findFirst({
    where:  { catalog_slug: slug, catalog_active: true, active: true },
    select: { id: true, settings: true, catalog_plan: true, subscription_active: true, subscription_expires_at: true },
  })
  if (!business || !isCatalogLive(business)) return NONE
  const financing = toPublicFinancing(readFinancingConfig(business.settings, business.id))
  if (!financing) return NONE
  const excluded = await prisma.product.findMany({
    where:  { business_id: business.id, financing_excluded: true },
    select: { id: true },
  })
  return { financing, excludedIds: excluded.map(p => p.id) }
}
