// -1 = ilimitado
export const PLAN_LIMITS = {
  trial:    { products: 50,  users: 2,  catalog: false, ai: false, suppliers: false },
  inicio:   { products: 100, users: 3,  catalog: false, ai: false, suppliers: true  },
  pro:      { products: 500, users: 10, catalog: true,  ai: false, suppliers: true  },
  business: { products: -1,  users: -1, catalog: true,  ai: true,  suppliers: true  },
} as const

export type PlanTier = keyof typeof PLAN_LIMITS

const PLAN_ORDER: PlanTier[] = ['trial', 'inicio', 'pro', 'business']

export function nextPlanTier(plan: PlanTier): PlanTier | undefined {
  return PLAN_ORDER[PLAN_ORDER.indexOf(plan) + 1]
}
