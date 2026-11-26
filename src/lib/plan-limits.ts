// Planes: gratis (imán de conversión, permanente, nunca vence), negocio_activo (hoy el único plan pago PUBLICADO, $19/mes; en Planes v2
// equivale a "Entrada") y operacion (v2, NO publicado: hasta 10 usuarios + KDS y Restaurante incluidos).
// -1 = ilimitado. Los flags booleanos gatean módulos completos.
//
// Planes v2 (.doc/HANDOFF_Planes_Precios_v2_25Nov2026.md): NO se gatea nada que los clientes actuales ya tienen (crédito, cotizaciones,
// catálogo Premium). Los flags nuevos `kds` y `restaurante` son DERECHOS: false en gratis y negocio_activo, true en operacion; `kds`
// además se concede por add-on (businesses.addons). El valor 'negocio_activo' se mantiene en DB para no migrar tenants.
export const PLAN_LIMITS = {
  gratis:         { products: 40, users: 1,  catalog: false, ai: false, suppliers: false, finanzas: false, exports: false, theme: false, landing_sections: false, analytics: false, kds: false, restaurante: false },
  negocio_activo: { products: -1, users: 10, catalog: true,  ai: true,  suppliers: true,  finanzas: true,  exports: true,  theme: true,  landing_sections: true,  analytics: true,  kds: false, restaurante: false },
  operacion:      { products: -1, users: 10, catalog: true,  ai: true,  suppliers: true,  finanzas: true,  exports: true,  theme: true,  landing_sections: true,  analytics: true,  kds: true,  restaurante: true  },
} as const

export type PlanTier = keyof typeof PLAN_LIMITS

/** Valores válidos de businesses.catalog_plan (única fuente para los zod de las rutas admin). */
export const PLAN_TIER_KEYS = ['gratis', 'negocio_activo', 'operacion'] as const satisfies readonly PlanTier[]

/** Niveles que cobran (todo menos gratis). */
export const isPaidPlan = (plan: string | null | undefined): plan is Exclude<PlanTier, 'gratis'> =>
  plan === 'negocio_activo' || plan === 'operacion'

/** Add-ons contratables (businesses.addons, CSV). Futuro: usuarios/sucursales extra serán columnas enteras aparte, no entran aquí. */
export const ADDON_KEYS = ['kds'] as const
export type AddonKey = typeof ADDON_KEYS[number]

/** Add-ons válidos de un CSV (ignora claves desconocidas, sin repetidos, orden estable). Puro: lo usan rutas y scripts. */
export function parseAddons(raw: string | null | undefined): AddonKey[] {
  const set = new Set((raw ?? '').split(',').map(s => s.trim()).filter(Boolean))
  return ADDON_KEYS.filter(k => set.has(k))
}

export const serializeAddons = (keys: readonly AddonKey[]): string => ADDON_KEYS.filter(k => keys.includes(k)).join(',')

/** Módulos/funciones con derecho (entitlement) propio: el flag del nivel O el add-on. */
export const ENTITLEMENT_KEYS = ['kds', 'restaurante'] as const
export type EntitlementKey = typeof ENTITLEMENT_KEYS[number]

// Nombre visible al usuario. El naming final de marca de los niveles NO está aprobado: vive solo aquí.
export const PLAN_DISPLAY: Record<PlanTier, string> = {
  gratis:         'Gratis',
  negocio_activo: 'Negocio Activo',
  operacion:      'Operación',
}

export const ADDON_DISPLAY: Record<AddonKey, string> = {
  kds: 'Cocina (KDS)',
}

// Escalera PÚBLICA de upgrade (/api/plan/check → upgrade_to). 'operacion' NO está aquí a propósito: no se publica ni se ofrece todavía.
const PLAN_ORDER: PlanTier[] = ['gratis', 'negocio_activo']

export function nextPlanTier(plan: PlanTier): PlanTier | undefined {
  return PLAN_ORDER[PLAN_ORDER.indexOf(plan) + 1]
}

export type BillingCycleKey = 'mensual' | 'trimestral' | 'semestral' | 'anual'

export interface BillingCycleAmounts {
  totalAmount:       number
  monthlyEquivalent: number
  savingsAmount:     number
  // % de ahorro de marketing (redondo, sellado) — NO se computa desde el total.
  savingsPct:        number
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Un ciclo a partir de su total FIJO (ya incluye el descuento). `monthly` es el precio mensual lleno del nivel/add-on: base del ahorro.
function cycle(totalAmount: number, months: number, savingsPct: number, monthly: number): BillingCycleAmounts {
  return {
    totalAmount,
    monthlyEquivalent: round2(totalAmount / months),
    savingsAmount:     round2(monthly * months - totalAmount),
    savingsPct,
  }
}

// ── Precios PUBLICADOS (vitrina) ──────────────────────────────────────────────
// Totales fijos del plan de $19 (rediseño 2026-07-17): 10/20/30% de marketing. NO se derivan de 19 × N.
const PUBLISHED_MONTHLY = { negocio_activo: 19 } as const
const PUBLISHED_NEGOCIO_ACTIVO: Record<BillingCycleKey, BillingCycleAmounts> = {
  mensual:    cycle(19,  1,  0,  PUBLISHED_MONTHLY.negocio_activo),
  trimestral: cycle(50,  3,  10, PUBLISHED_MONTHLY.negocio_activo),
  semestral:  cycle(90,  6,  20, PUBLISHED_MONTHLY.negocio_activo),
  anual:      cycle(156, 12, 30, PUBLISHED_MONTHLY.negocio_activo),
}

// ── Precios de TRABAJO v2 (NO publicados): ÚNICO lugar editable ───────────────
export const WORKING_PRICES = {
  negocio_activo: 29,   // "Entrada"
  operacion:      39,
  addons:         { kds: 8 } satisfies Record<AddonKey, number>,
} as const

/** true SOLO cuando Carlos apruebe publicar: pasa los precios de trabajo a BILLING_CYCLES (vitrina, /planes, llms). Hoy false. */
export const PRICES_PUBLISHED = false

// Escalera de ciclos v2: 0% / ≈5% / ≈10% / 2 meses gratis (anual = 10 meses). Totales redondeados HACIA ABAJO a entero (vitrina).
function workingCycles(monthly: number): Record<BillingCycleKey, BillingCycleAmounts> {
  return {
    mensual:    cycle(monthly,                          1,  0,  monthly),
    trimestral: cycle(Math.floor(monthly * 3 * 0.95),   3,  5,  monthly),
    semestral:  cycle(Math.floor(monthly * 6 * 0.9),    6,  10, monthly),
    anual:      cycle(monthly * 10,                     12, 17, monthly),
  }
}

/** Ciclos con los precios de trabajo v2 (para pruebas, el panel admin y la futura vitrina). */
export const WORKING_BILLING_CYCLES: Record<Exclude<PlanTier, 'gratis'>, Record<BillingCycleKey, BillingCycleAmounts>> = {
  negocio_activo: workingCycles(WORKING_PRICES.negocio_activo),
  operacion:      workingCycles(WORKING_PRICES.operacion),
}
export const WORKING_ADDON_CYCLES: Record<AddonKey, Record<BillingCycleKey, BillingCycleAmounts>> = {
  kds: workingCycles(WORKING_PRICES.addons.kds),
}

// Lo que lee la vitrina. Hasta que PRICES_PUBLISHED sea true, negocio_activo sigue en $19 (clientes actuales a $19: grandfathering) y
// ninguna página lista 'operacion' (todas iteran niveles explícitos). Gratis no vence ni cobra.
export const BILLING_CYCLES: Record<Exclude<PlanTier, 'gratis'>, Record<BillingCycleKey, BillingCycleAmounts>> = {
  negocio_activo: PRICES_PUBLISHED ? WORKING_BILLING_CYCLES.negocio_activo : PUBLISHED_NEGOCIO_ACTIVO,
  operacion:      WORKING_BILLING_CYCLES.operacion,
}
