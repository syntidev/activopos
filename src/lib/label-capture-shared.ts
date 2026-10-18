/**
 * Captura de etiquetas Safetti — reglas puras compartidas entre cliente y servidor.
 * Sin imports de servidor (prisma, next/headers): este módulo se bundlea al cliente.
 */

export const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] as const
export type LabelSize = (typeof SIZES)[number]

export const REF_RE = /^\d{5}[A-Z]$/
export const EAN_RE = /^\d{13}$/

/** Metas del conteo físico (27 productos Safetti: 61 variantes, 66 unidades). */
export const GOAL_VARIANTS = 61
export const GOAL_UNITS = 66

/** EAN-13: 13 dígitos y el último es el dígito de control. */
export function isValidEan13(ean: string): boolean {
  if (!EAN_RE.test(ean)) return false
  const digits = Array.from(ean, Number)
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10 === digits[12]
}

/** Talla de lista cerrada, o '' si no es una de ellas. */
export function normalizeSize(raw: string): LabelSize | '' {
  const up = raw.trim().toUpperCase()
  return (SIZES as readonly string[]).includes(up) ? (up as LabelSize) : ''
}

/** Primer `\d{5}[A-Z]` del texto, en mayúsculas, o ''. */
export function extractRef(raw: string): string {
  return /\d{5}[A-Z]/.exec(raw.toUpperCase())?.[0] ?? ''
}
