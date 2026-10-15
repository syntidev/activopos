// Sellos de financiamiento del catálogo público. Agregar otra financiadora = una entrada
// acá (+ su asset oficial en public/brand/); ningún componente cambia.
export interface FinancingBadge {
  src:    string
  alt:    string
  width:  number
  height: number
}

export const FINANCING_BADGES = {
  cashea: { src: '/brand/cashea.png', alt: 'Disponible con Cashea', width: 448, height: 128 },
} as const satisfies Record<string, FinancingBadge>

export type FinancingBadgeKey = keyof typeof FINANCING_BADGES

export function isFinancingBadgeKey(value: unknown): value is FinancingBadgeKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FINANCING_BADGES, value)
}
