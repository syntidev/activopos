// -1 = ilimitado
export const PLAN_LIMITS = {
  trial:    { products: 50,  users: 2,  catalog: false, ai: false, suppliers: false },
  inicio:   { products: 100, users: 3,  catalog: false, ai: false, suppliers: true  },
  pro:      { products: 500, users: 10, catalog: true,  ai: false, suppliers: true  },
  business: { products: -1,  users: -1, catalog: true,  ai: true,  suppliers: true  },
} as const

export type PlanTier = keyof typeof PLAN_LIMITS

// Nombre visible al usuario — el código interno (trial/inicio/pro/business)
// no coincide con el naming de la landing (Mostrador/Negocio/Pro). La DB
// sigue guardando el tier interno; esto es solo para textos de UI.
export const PLAN_DISPLAY: Record<PlanTier, string> = {
  trial:    'Prueba gratuita',
  inicio:   'Mostrador',
  pro:      'Negocio',
  business: 'Pro',
}

const PLAN_ORDER: PlanTier[] = ['trial', 'inicio', 'pro', 'business']

export function nextPlanTier(plan: PlanTier): PlanTier | undefined {
  return PLAN_ORDER[PLAN_ORDER.indexOf(plan) + 1]
}

export type BillingCycleKey = 'mensual' | 'trimestral' | 'semestral' | 'anual'

export interface BillingCycleAmounts {
  totalAmount:       number
  monthlyEquivalent: number
  savingsAmount:     number
}

const round2 = (n: number) => Math.round(n * 100) / 100

function computeCycle(monthlyPrice: number, months: number, discountPct: number): BillingCycleAmounts {
  const fullPrice   = monthlyPrice * months
  const totalAmount = round2(fullPrice * (1 - discountPct / 100))
  return {
    totalAmount,
    monthlyEquivalent: round2(totalAmount / months),
    savingsAmount:     round2(fullPrice - totalAmount),
  }
}

function buildCycles(monthlyPrice: number): Record<BillingCycleKey, BillingCycleAmounts> {
  return {
    mensual:    computeCycle(monthlyPrice, 1,  0),
    trimestral: computeCycle(monthlyPrice, 3,  10),
    semestral:  computeCycle(monthlyPrice, 6,  15),
    anual:      computeCycle(monthlyPrice, 12, 20),
  }
}

// trial no tiene precio — solo los planes de pago tienen ciclo de facturación
// Precios rectificados por el dueño del negocio 2026-07-11 (antes 9/19/29).
export const BILLING_CYCLES: Record<Exclude<PlanTier, 'trial'>, Record<BillingCycleKey, BillingCycleAmounts>> = {
  inicio:   buildCycles(15),
  pro:      buildCycles(25),
  business: buildCycles(40),
}
