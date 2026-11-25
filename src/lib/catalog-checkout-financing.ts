import { prisma } from '@/lib/prisma'
import { isCatalogLive } from '@/lib/catalog'
import { readFinancingConfig, toPublicFinancing } from '@/lib/financing'
import { chipMethods, readCobroEffective } from '@/lib/cobro-precios'
import type { PublicFinancing } from '@/lib/financing'
import { PAY_DEFAULT, type CartPayOptions } from '@/lib/cart-pay'

export interface CheckoutFinancingData {
  /** null = el negocio no tiene financiamiento activo: el checkout no ofrece Cashea. */
  financing: PublicFinancing | null
  /** Productos excluidos del financiamiento; el checkout los cruza con el carrito. */
  excludedIds: number[]
}

const NONE: CheckoutFinancingData = { financing: null, excludedIds: [] }
const SLUG_RE = /^[a-z0-9-]{1,60}$/

/** Lo que el negocio decidió en Configuración › Cobro y precios y el catálogo público necesita pintar. Por defecto, todo encendido. */
export async function loadCobroFlags(slug: string): Promise<{ casheaActive: boolean; pay: CartPayOptions }> {
  if (!SLUG_RE.test(slug)) return { casheaActive: true, pay: PAY_DEFAULT }
  const business = await prisma.business.findFirst({ where: { catalog_slug: slug, catalog_active: true, active: true }, select: { id: true, settings: true } })
  if (!business) return { casheaActive: true, pay: PAY_DEFAULT }
  const eff = readCobroEffective(business.settings)
  const methods = await prisma.paymentMethod.findMany({
    where: { business_id: business.id, is_active: true }, select: { id: true, name: true, type: true, is_financing: true }, orderBy: { sort_order: 'asc' },
  })
  const chips = chipMethods(methods, business.settings)
  const bs = chips.bs.filter(m => !m.is_financing).map(m => ({ id: m.id, name: m.name }))
  return {
    casheaActive: eff.casheaActive,
    pay: { divisa: chips.divisa.map(m => ({ id: m.id, name: m.name })), bs, bsGenerico: !eff.hideBsMethods && bs.length === 0 },
  }
}

/** Datos públicos para el selector de pago del checkout (mismo criterio que la ficha: settings.financing). */
export async function loadCheckoutFinancing(slug: string): Promise<CheckoutFinancingData> {
  if (!SLUG_RE.test(slug)) return NONE
  const business = await prisma.business.findFirst({
    where:  { catalog_slug: slug, catalog_active: true, active: true },
    select: { id: true, settings: true, catalog_plan: true, subscription_active: true, subscription_expires_at: true },
  })
  if (!business || !isCatalogLive(business)) return NONE
  const financing = toPublicFinancing(readFinancingConfig(business.settings, business.id))
  if (!financing || !readCobroEffective(business.settings).casheaActive) return NONE
  // Solo los excluidos que el cliente puede llegar a tener en el carrito (activos y disponibles): no se filtran al
  // navegador ids de productos desactivados u ocultos.
  const excluded = await prisma.product.findMany({
    where:  { business_id: business.id, financing_excluded: true, active: true, is_available: true },
    select: { id: true },
  })
  return { financing, excludedIds: excluded.map(p => p.id) }
}
