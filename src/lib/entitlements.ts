import { prisma } from './prisma'
import {
  ADDON_KEYS, ENTITLEMENT_KEYS, PLAN_LIMITS, PLAN_DISPLAY,
  type AddonKey, type EntitlementKey, type PlanTier,
} from './plan-limits'

/**
 * Permisos por plan (Planes v2, adenda B). Tres conceptos que NO se mezclan:
 *   Derecho (entitlement)  → catalog_plan + addons           → solo lo escribe el super_admin
 *   Preferencia            → modules_enabled                 → solo lo escribe el tenant
 *   Estado de cuenta       → subscription_active/expires_at  → super_admin / billing
 * Acceso efectivo = Derecho Y Preferencia Y Estado de cuenta vigente. Se evalúa en el SERVIDOR al USAR el módulo, no solo al activarlo.
 */

/** Columnas de businesses que necesita esta capa (un solo select para todos los llamadores). */
export const ENTITLEMENT_SELECT = {
  catalog_plan: true, subscription_active: true, subscription_expires_at: true, addons: true, modules_enabled: true,
} as const

export interface EntitlementSource {
  catalog_plan:            string | null
  subscription_active:     boolean
  subscription_expires_at: Date | null
  addons:                  string | null
  modules_enabled:         string | null
}

export type Entitlements = Record<EntitlementKey, boolean>

const csv = (v: string | null | undefined): string[] => (v ?? '').split(',').map(s => s.trim()).filter(Boolean)
const isAddon = (k: string): k is AddonKey => (ADDON_KEYS as readonly string[]).includes(k)

/** Add-ons válidos de un CSV (ignora claves desconocidas, sin repetidos, orden estable). */
export function parseAddons(raw: string | null | undefined): AddonKey[] {
  const set = new Set(csv(raw))
  return ADDON_KEYS.filter(k => set.has(k))
}

export const serializeAddons = (keys: readonly AddonKey[]): string => ADDON_KEYS.filter(k => keys.includes(k)).join(',')

export function planOf(b: Pick<EntitlementSource, 'catalog_plan'>): PlanTier {
  const p = b.catalog_plan as PlanTier | null
  return p && p in PLAN_LIMITS ? p : 'gratis'
}

/** Estado de cuenta: no suspendida y no vencida. */
export function subscriptionValid(b: Pick<EntitlementSource, 'subscription_active' | 'subscription_expires_at'>, now: Date = new Date()): boolean {
  if (!b.subscription_active) return false
  return !(b.subscription_expires_at && now > b.subscription_expires_at)
}

/** Derecho: suscripción vigente Y (flag del nivel O add-on). */
export function hasEntitlement(b: EntitlementSource, key: EntitlementKey, now: Date = new Date()): boolean {
  if (!subscriptionValid(b, now)) return false
  if (PLAN_LIMITS[planOf(b)][key]) return true
  return isAddon(key) && parseAddons(b.addons).includes(key)
}

/** Derecho Y preferencia: el módulo está pagado Y el tenant lo tiene encendido. */
export function canUse(b: EntitlementSource, key: EntitlementKey, now: Date = new Date()): boolean {
  return hasEntitlement(b, key, now) && csv(b.modules_enabled).includes(key)
}

/** Todos los derechos de un negocio (lo que devuelve GET /api/config/business/modules para que Sidebar y TabModulos decidan desde una fuente). */
export function entitlementsOf(b: EntitlementSource, now: Date = new Date()): Entitlements {
  return Object.fromEntries(ENTITLEMENT_KEYS.map(k => [k, hasEntitlement(b, k, now)])) as Entitlements
}

/** Por qué no hay derecho (mensaje para planDenied). */
export function entitlementDeniedReason(b: EntitlementSource, key: EntitlementKey, now: Date = new Date()): string {
  if (!b.subscription_active) return 'Tu suscripción está suspendida. Contacta a soporte.'
  if (!subscriptionValid(b, now)) return 'Tu plan expiró. Renueva para continuar.'
  return key === 'kds'
    ? `La pantalla de cocina (KDS) requiere el plan ${PLAN_DISPLAY.operacion} o el complemento Cocina.`
    : `Restaurante requiere el plan ${PLAN_DISPLAY.operacion}.`
}

/** Lee el negocio de la sesión (fuente: DB, nunca el JWT ni el body). null si no existe. */
export async function loadEntitlementSource(businessId: number): Promise<EntitlementSource | null> {
  return prisma.business.findUnique({ where: { id: businessId }, select: ENTITLEMENT_SELECT })
}
