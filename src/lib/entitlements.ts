import { NextResponse } from 'next/server'
import { prisma } from './prisma'
import { planDenied } from './plan-guard'
import {
  ADDON_KEYS, ENTITLEMENT_KEYS, PLAN_LIMITS, PLAN_DISPLAY, isPaidPlan, parseAddons, serializeAddons,
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

// parseAddons/serializeAddons viven en lib/plan-limits (puros); se re-exportan para no romper imports.
export { parseAddons, serializeAddons }

export function planOf(b: Pick<EntitlementSource, 'catalog_plan'>): PlanTier {
  const p = b.catalog_plan as PlanTier | null
  return p && p in PLAN_LIMITS ? p : 'gratis'
}

/** Estado de cuenta: no suspendida y no vencida. */
export function subscriptionValid(b: Pick<EntitlementSource, 'subscription_active' | 'subscription_expires_at'>, now: Date = new Date()): boolean {
  if (!b.subscription_active) return false
  return !(b.subscription_expires_at && now > b.subscription_expires_at)
}

/**
 * Derecho: suscripción vigente Y (flag del nivel O add-on). El add-on es un COMPLEMENTO de un plan pago: sobre 'gratis' no concede nada
 * (gratis + add-on = sin derecho), aunque el super_admin lo haya guardado.
 */
export function hasEntitlement(b: EntitlementSource, key: EntitlementKey, now: Date = new Date()): boolean {
  if (!subscriptionValid(b, now)) return false
  const plan = planOf(b)
  if (PLAN_LIMITS[plan][key]) return true
  return isPaidPlan(plan) && isAddon(key) && parseAddons(b.addons).includes(key)
}

/**
 * Módulos cuya PREFERENCIA vive en modules_enabled (hoy solo 'kds'). 'restaurante' NO está aquí: es un derecho (PLAN_LIMITS.restaurante) y
 * su preferencia será Business.restaurante_enabled (viene con feat/restaurante), que se combina con hasEntitlement(b, 'restaurante').
 */
export type PreferenceModuleKey = Extract<EntitlementKey, 'kds'>

/** Derecho Y preferencia: el módulo está pagado Y el tenant lo tiene encendido en modules_enabled. */
export function canUse(b: EntitlementSource, key: PreferenceModuleKey, now: Date = new Date()): boolean {
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

/**
 * Guard de USO para rutas del servidor. null = puede usar; si no, la respuesta 403 lista para devolver:
 *   sin derecho (plan/add-on/suscripción) → planDenied() = 403 { code: 'PLAN_LIMIT' }  (el frontend muestra el paywall)
 *   con derecho pero módulo apagado por el tenant → 403 { code: 'MODULE_DISABLED' }    (NO es un paywall: se enciende en Configuración)
 */
export async function guardEntitlement(businessId: number, key: PreferenceModuleKey): Promise<NextResponse | null> {
  const b = await loadEntitlementSource(businessId)
  if (!b) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  if (!hasEntitlement(b, key)) return planDenied(entitlementDeniedReason(b, key))
  if (!canUse(b, key)) {
    return NextResponse.json({ error: 'Este módulo está apagado en Configuración > Módulos.', code: 'MODULE_DISABLED' }, { status: 403 })
  }
  return null
}
