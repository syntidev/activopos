// Cédula / RIF: ÚNICA regla de formato del sistema (cliente y servidor).
// Se guarda normalizada: "V-12345678". Sin dependencias: corre en ambos lados.
//
// - Con financiadora: persona natural, V o E + 5 a 9 dígitos. Rechaza J-/G-.
// - Sin financiadora: opcional; si viene, acepta V/E (5-9 dígitos) o J/G (5-10).

const NATURAL_RE = /^([VE])-(\d{5,9})$/
const GENERAL_RE = /^([VEJG])-(\d{5,10})$/

export const CEDULA_FORMAT_HINT = 'Usa el formato V-12345678 o E-12345678.'

/** Quita espacios, puntos y guiones y devuelve "L-dígitos" en mayúscula, o null si no calza. */
export function normalizeCedula(raw: string | null | undefined): string | null {
  const compact = (raw ?? '').toUpperCase().replace(/[\s.\-_]/g, '')
  const m = /^([A-Z])(\d+)$/.exec(compact)
  return m ? `${m[1]}-${m[2]}` : null
}

export function isNaturalCedula(normalized: string): boolean {
  return NATURAL_RE.test(normalized)
}

export type CedulaCheck =
  | { ok: true;  value: string | null }
  | { ok: false; message: string }

/** Mensaje claro cuando la financiadora exige cédula (usa el nombre REAL del método). */
export function financingCedulaMessage(methodName: string): string {
  return `${methodName} necesita tu cédula para crear el enlace de pago. ${CEDULA_FORMAT_HINT}`
}

/**
 * Valida y normaliza. `financingName` = nombre del método financiador elegido,
 * o null si no hay. Vacío sin financiadora = ok (null); con financiadora = error.
 */
export function checkCedula(raw: string | null | undefined, financingName: string | null): CedulaCheck {
  const hasValue = (raw ?? '').trim() !== ''
  if (financingName !== null) {
    const n = normalizeCedula(raw)
    if (!hasValue || !n || !isNaturalCedula(n)) {
      return { ok: false, message: financingCedulaMessage(financingName) }
    }
    return { ok: true, value: n }
  }
  if (!hasValue) return { ok: true, value: null }
  const n = normalizeCedula(raw)
  if (!n || !GENERAL_RE.test(n)) {
    return { ok: false, message: `Cédula / RIF no válido. ${CEDULA_FORMAT_HINT}` }
  }
  return { ok: true, value: n }
}

/** V-12345678 → V-****5678 (para listas). */
export function maskCedula(cedula: string | null | undefined): string | null {
  const n = normalizeCedula(cedula)
  if (!n) return null
  const [letter, digits] = n.split('-')
  return `${letter}-${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
}
