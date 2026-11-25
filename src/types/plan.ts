import type { AddonKey, PlanTier } from '@/lib/plan-limits'
import type { Entitlements } from '@/lib/entitlements'

/**
 * CONTRATO de Planes v2 (backend → UI). Fuente: .doc/HANDOFF_Planes_v2_Adenda_KDS_Entitlements.md.
 * Reglas: el cliente envía el estado ABSOLUTO deseado (nunca "alternar"), guarda con un único botón, y rehidrata desde la respuesta
 * canónica (sin actualizaciones optimistas). Derecho (plan/addons) lo escribe solo el super_admin; preferencia (modules_enabled) el tenant.
 */

/** Estado canónico de un tenant, leído de la DB DESPUÉS de escribir. */
export interface TenantPlanState {
  id:                      number
  /** Valor guardado en businesses.catalog_plan ('negocio_activo' = Entrada; se mantiene en DB). */
  catalog_plan:            PlanTier
  catalog_active:          boolean
  subscription_active:     boolean
  /** YYYY-MM-DD o null (gratis no vence). */
  subscription_expires_at: string | null
  /** Add-ons contratados (derecho). */
  addons:                  AddonKey[]
  /** Preferencia del tenant (no se edita desde este endpoint). */
  modules_enabled:         string[]
  /** Derechos efectivos HOY (plan vigente + add-ons): lo que Sidebar/TabModulos deben respetar. */
  entitlements:            Entitlements
  /** Pedidos abiertos en cocina (send_to_kds, recibido/preparando/listo): el panel los muestra y pide confirmación al quitar KDS o bajar de nivel. */
  open_kds_orders:         number
}

/** Cuerpo de PATCH /api/admin/tenants/[id]/plan (solo super_admin). */
export interface PlanPatchBody {
  plan:            PlanTier
  status:          'active' | 'expired' | 'suspended'
  /** YYYY-MM-DD; null limpia la fecha; omitido la deja igual. */
  expires_at?:     string | null
  catalog_active?: boolean
  /** CONJUNTO ABSOLUTO de add-ons deseado (idempotente). Omitido = sin cambios; [] = quitar todos. Claves desconocidas → 400. */
  addons?:         AddonKey[]
}

/** Respuesta de PATCH /api/admin/tenants/[id]/plan. */
export interface PlanPatchResponse {
  ok:                     true
  catalog_published_auto: boolean
  /** true si el conjunto de add-ons cambió (y quedó ActivityLog 'addon_updated'). */
  addons_changed:         boolean
  business:               TenantPlanState
}

/** Respuesta de GET /api/admin/tenants/[id]/plan (estado actual, p. ej. para mostrar el conteo antes de confirmar un downgrade). */
export interface PlanGetResponse {
  ok:       true
  business: TenantPlanState
}

/** Respuesta de GET /api/config/business/modules (además de lo que ya devolvía). */
export interface ModulesEntitlementsField {
  entitlements: Entitlements
  /** Add-ons contratados, solo lectura para el tenant. */
  addons:       AddonKey[]
}
