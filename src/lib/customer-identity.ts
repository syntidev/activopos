// Identidad del cliente en el checkout público: cédula (ÚNICA llave), teléfono (solo respaldo) y nombre.
// Sin dependencias de DB: corre en servidor y cliente. La unicidad por cédula es de APLICACIÓN
// (no hay @@unique: en producción existen cédulas duplicadas).

import { normalizeCedula } from './cedula'

const CHECKOUT_CEDULA_RE = /^([VEJG])-(\d{5,10})$/
const ALL_ZEROS_RE = /^[A-Z]-0+$/
const MIN_PHONE_DIGITS = 7

export const CHECKOUT_CEDULA_MESSAGE =
  'Indica una cédula o RIF válido, por ejemplo V-12345678 (V, E, J o G).'

export type CheckoutCedula =
  | { ok: true;  value: string }
  | { ok: false; message: string }

/**
 * Cédula del checkout público: OBLIGATORIA siempre (retiro o envío). Se aceptan V/E/J/G con
 * 5 a 10 dígitos; se rechazan solo vacíos, formatos inválidos y cédulas de solo ceros.
 * Devuelve el valor normalizado "V-12345678".
 */
export function checkCheckoutCedula(raw: string | null | undefined): CheckoutCedula {
  const n = normalizeCedula(raw)
  if (!n || !CHECKOUT_CEDULA_RE.test(n) || ALL_ZEROS_RE.test(n)) {
    return { ok: false, message: CHECKOUT_CEDULA_MESSAGE }
  }
  return { ok: true, value: n }
}

/**
 * Teléfono a dígitos. Formato venezolano → nacional de 11 dígitos (04141234567); cualquier otro
 * se deja en dígitos tal cual. '' si no hay dígitos.
 */
export function normalizeClientPhone(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 12 && digits.startsWith('58')) return `0${digits.slice(2)}`
  if (digits.length === 10 && !digits.startsWith('0')) return `0${digits}`
  return digits
}

export function hasUsablePhone(raw: string | null | undefined): boolean {
  return normalizeClientPhone(raw).length >= MIN_PHONE_DIGITS
}

/**
 * Formas en que un teléfono pudo quedar guardado como texto libre (0414-1234567, 4141234567,
 * +58 414 1234567...). Sirve para buscar el respaldo por teléfono con `phone IN (...)`.
 * ponytail: no cubre separadores arbitrarios; si hiciera falta, columna phone_digits indexada.
 */
export function phoneLookupVariants(raw: string | null | undefined): string[] {
  const national = normalizeClientPhone(raw)
  if (!national) return []
  if (national.length === 11 && national.startsWith('0')) {
    const core = national.slice(1)
    return [
      national, core, `58${core}`, `+58${core}`,
      `${national.slice(0, 4)}-${national.slice(4)}`, `${national.slice(0, 4)} ${national.slice(4)}`,
      `+58 ${core.slice(0, 3)} ${core.slice(3)}`, `+58-${core.slice(0, 3)}-${core.slice(3)}`,
    ]
  }
  return [national]
}

const foldName = (s: string): string[] =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)

/**
 * ¿Es la misma persona? Sin acentos ni mayúsculas, y el nombre más corto debe estar contenido en
 * el más largo ("Juan Pérez" = "juan carlos perez gomez"). Distinto nombre → alerta, no bloqueo.
 */
export function sameName(a: string, b: string): boolean {
  const ta = foldName(a)
  const tb = foldName(b)
  if (ta.length === 0 || tb.length === 0) return false
  const [small, large] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  const set = new Set(large)
  return small.every(t => set.has(t))
}
