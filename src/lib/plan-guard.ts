import { PLAN_LIMITS, PLAN_DISPLAY, type PlanTier } from './plan-limits'
import { getAuthenticatedTenant } from './tenant'
import { prisma } from './prisma'

export type PlanAction =
  | 'create_product' | 'create_user' | 'access_catalog' | 'access_ai'
  | 'create_supplier' | 'access_finanzas' | 'access_export' | 'access_theme'

const PAID = PLAN_DISPLAY.negocio_activo

// El plan se lee de la DB en cada llamada — nunca del JWT ni del body (evita bypass por cliente desactualizado)
export async function checkPlanLimit(action: PlanAction): Promise<{ allowed: boolean; reason?: string }> {
  const { session } = await getAuthenticatedTenant()
  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { catalog_plan: true, subscription_active: true, subscription_expires_at: true },
  })

  if (!business) return { allowed: false, reason: 'Negocio no encontrado' }

  const plan = (business.catalog_plan as PlanTier | null) ?? 'gratis'
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.gratis

  if (!business.subscription_active) {
    return { allowed: false, reason: 'Tu suscripción está suspendida. Contacta a soporte.' }
  }

  if (business.subscription_expires_at && new Date() > business.subscription_expires_at) {
    return { allowed: false, reason: 'Tu plan expiró. Renueva para continuar.' }
  }

  if (action === 'create_product') {
    if (limits.products === -1) return { allowed: true }
    const count = await prisma.product.count({ where: { business_id: session.businessId, active: true } })
    if (count >= limits.products) {
      return { allowed: false, reason: `Límite de ${limits.products} productos alcanzado en tu plan ${PLAN_DISPLAY[plan]}.` }
    }
  }

  if (action === 'create_user') {
    const count = await prisma.user.count({ where: { business_id: session.businessId } })
    if (count >= limits.users) {
      return { allowed: false, reason: `Límite de ${limits.users} usuarios alcanzado en tu plan ${PLAN_DISPLAY[plan]}.` }
    }
  }

  if (action === 'access_catalog') {
    if (session.role === 'admin' || session.role === 'super_admin') return { allowed: true }
    if (!limits.catalog) {
      return { allowed: false, reason: `El catálogo digital requiere plan ${PAID}.` }
    }
  }

  if (action === 'access_ai' && !limits.ai) {
    return { allowed: false, reason: `El asistente IA requiere plan ${PAID}.` }
  }

  if (action === 'create_supplier' && !limits.suppliers) {
    return { allowed: false, reason: `El módulo de proveedores requiere plan ${PAID}.` }
  }

  if (action === 'access_finanzas' && !limits.finanzas) {
    return { allowed: false, reason: `El módulo de finanzas requiere plan ${PAID}.` }
  }

  if (action === 'access_export' && !limits.exports) {
    return { allowed: false, reason: `Los reportes en Excel requieren plan ${PAID}.` }
  }

  if (action === 'access_theme' && !limits.theme) {
    return { allowed: false, reason: `El tema visual del catálogo requiere plan ${PAID}.` }
  }

  return { allowed: true }
}
