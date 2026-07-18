// Modelo de 2 planes (rediseño 2026-07-17): gratis (imán de conversión,
// permanente, nunca vence) + negocio_activo (único plan pago, $19/mes).
// -1 = ilimitado. Los flags booleanos gatean módulos completos.
export const PLAN_LIMITS = {
  gratis:         { products: 40, users: 1,  catalog: false, ai: false, suppliers: false, finanzas: false, exports: false, theme: false },
  negocio_activo: { products: -1, users: 10, catalog: true,  ai: true,  suppliers: true,  finanzas: true,  exports: true,  theme: true  },
} as const

export type PlanTier = keyof typeof PLAN_LIMITS

// Nombre visible al usuario.
export const PLAN_DISPLAY: Record<PlanTier, string> = {
  gratis:         'Gratis',
  negocio_activo: 'Negocio Activo',
}

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
  // El % real (savingsAmount / rate lleno) da 12/21/32; el mostrado es 10/20/30.
  savingsPct:        number
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Precios definitivos del único plan pago ($19/mes), ciclos con descuento por
// permanencia. Los totales son fijos (ya incluyen el descuento) — NO se derivan
// de 19 × N. monthlyEquivalent y savingsAmount se calculan desde el total real;
// savingsPct es el número de marketing acordado, fijo por ciclo.
function cycle(totalAmount: number, months: number, savingsPct: number): BillingCycleAmounts {
  const MONTHLY = 19
  return {
    totalAmount,
    monthlyEquivalent: round2(totalAmount / months),
    savingsAmount:     round2(MONTHLY * months - totalAmount),
    savingsPct,
  }
}

// Solo negocio_activo tiene ciclo de facturación — gratis no vence ni cobra.
export const BILLING_CYCLES: Record<Exclude<PlanTier, 'gratis'>, Record<BillingCycleKey, BillingCycleAmounts>> = {
  negocio_activo: {
    mensual:    cycle(19,  1,  0),
    trimestral: cycle(50,  3,  10),
    semestral:  cycle(90,  6,  20),
    anual:      cycle(156, 12, 30),
  },
}
