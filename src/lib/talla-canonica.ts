/**
 * Talla CANÓNICA: fuente única para importador, editor, alta rápida, búsqueda y filtro de talla. Sin dependencias
 * (cliente, servidor y scripts la importan igual). Las transformaciones de talla viven AQUÍ, en código con tests:
 * nunca reescrituras masivas de `valor` con REGEXP_REPLACE y \1/\2 en SQL.
 *
 *   Calzado   "EU {n} · US {n}"  (EU primero, uso venezolano) · unisex "EU {n} · M{n} / W{n}" · solo EU "EU {n}"
 *             número suelto 34–50 (con .5 o coma) = "EU {n}". Sin EU → error pidiendo EU.
 *   Ropa      XXS, XS, S, M, L, XL, 2XL, 3XL, 4XL ("XXL" → "2XL", "TALLA M" → "M"); rangos "S-M" / "S/M" → "S/M"; "Única".
 *   Niños     número entero 2–16.
 *   Inválido  vacío, "POR DEFINIR" o irreconocible → { error }.
 * Si el valor es una talla reconocible, el tipo es SIEMPRE 'talla' (nunca 'personalizado').
 */

export type GrupoTalla = 'calzado' | 'ropa' | 'ninos'
export interface TallaCanonica { valor: string; tipo: 'talla'; grupo: GrupoTalla }
export interface TallaError { error: string }
export interface ContextoTalla {
  /** Se sabe que es calzado (p. ej. el editor con el tipo "Calzado"): acepta EU 17–33 (calzado infantil). */
  calzado?: boolean
}

export const ROPA_TALLAS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'] as const
/** Letras de ropa que la búsqueda reconoce solas ("XL"): las mismas de la talla canónica. */
export const SIZE_LETTERS: ReadonlySet<string> = new Set(ROPA_TALLAS.map(t => t.toLowerCase()))

const ALIAS_ROPA: Record<string, string> = { XXL: '2XL', XXXL: '3XL', XXXXL: '4XL', '2X': '2XL', '3X': '3XL', '4X': '4XL' }
const UNICA = new Set(['UNICA', 'ÚNICA', 'UNICO', 'ÚNICO', 'U', 'UNICA TALLA', 'TALLA UNICA', 'ONE SIZE', 'OS'])

// Calzado con tercios (Hoka: "EU 41 1/3", "EU 42 2/3"): la fracción se conserva tal cual, no se redondea.
const NUM = String.raw`\d{1,2}(?:[.,]\d|\s+[12]/3)?`
const EU = new RegExp(String.raw`\bEU\s*(${NUM})(?!\d)`, 'i')
const US = new RegExp(String.raw`\bUS\s*(${NUM})(?!\d)`, 'i')
const MEN = new RegExp(String.raw`\bM\s*(${NUM})(?!\d)`, 'i')
const WOMEN = new RegExp(String.raw`\bW\s*(${NUM})(?!\d)`, 'i')

const punto = (n: string): string => n.replace(',', '.')
const TERCIO = /^(\d{1,2})\s+([12])\/3$/
/** "45.0" → "45"; "42.5" → "42.5"; "41  1/3" → "41 1/3". */
const limpio = (n: string): string => {
  const t = TERCIO.exec(n.trim())
  return t ? `${t[1]} ${t[2]}/3` : String(Number(punto(n)))
}

/** Valor numérico de una talla ("42.5" → 42.5, "41 1/3" → 41.33…): rangos y orden de chips. */
export function numeroTalla(txt: string): number {
  const t = TERCIO.exec(txt.trim())
  return t ? Number(t[1]) + Number(t[2]) / 3 : Number(punto(txt))
}

/** Pega la fracción a su entero ("42 2/3" → "42~2t") para tratar la talla como UN token al partir por espacios y "/". */
export const pegarTercios = (s: string): string => s.replace(/(\d)\s+([12])\/3/g, '$1~$2t')

/** "EU 42.5" → "42.5"; "EU 42 2/3" → "42 2/3"; "42" → "42"; ropa u otros → null. Para el filtro de talla del catálogo. */
export function euDe(valor: string): string | null {
  const m = EU.exec(valor)
  if (m) return limpio(m[1])
  const s = /^\s*(\d{2}(?:[.,]\d|\s+[12]\/3)?)\s*$/.exec(valor)
  return s ? limpio(s[1]) : null
}

/** "US 9" si el valor trae equivalente US. */
export function usDe(valor: string): string | null {
  const m = US.exec(valor)
  return m ? `US ${punto(m[1])}` : null
}

const ropaToken = (t: string): string | null => {
  const u = t.toUpperCase()
  const v = ALIAS_ROPA[u] ?? u
  return (ROPA_TALLAS as readonly string[]).includes(v) ? v : null
}

function calzado(raw: string): TallaCanonica | TallaError | null {
  const eu = EU.exec(raw), us = US.exec(raw), m = MEN.exec(raw), w = WOMEN.exec(raw)
  if (!eu && !us && !m && !w) return null
  if (!eu) return { error: `talla '${raw}' sin EU: escribe la talla EU (34–50), p. ej. "EU 42.5 · US 9"` }
  const n = numeroTalla(eu[1])
  if (n < 17 || n > 52) return { error: `talla EU '${eu[1]}' fuera de rango (17–52)` }
  const partes = [`EU ${limpio(eu[1])}`]
  if (us) partes.push(`US ${limpio(us[1])}`)
  else if (m || w) partes.push([m ? `M${limpio(m[1])}` : '', w ? `W${limpio(w[1])}` : ''].filter(Boolean).join(' / '))
  return { valor: partes.join(' · '), tipo: 'talla', grupo: 'calzado' }
}

export function canonizarTalla(entrada: string, contexto: ContextoTalla = {}): TallaCanonica | TallaError {
  const raw = (entrada ?? '').replace(/\s+/g, ' ').trim()
  if (!raw) return { error: 'talla vacía' }
  const sinPrefijo = raw.replace(/^(talla|t\.)\s*:?\s*/i, '').trim()
  if (!sinPrefijo) return { error: `talla '${raw}' no reconocida` }

  const zap = calzado(sinPrefijo)
  if (zap) return zap

  const u = sinPrefijo.toUpperCase()
  if (UNICA.has(u)) return { valor: 'Única', tipo: 'talla', grupo: 'ropa' }

  const solo = ropaToken(u.replace(/\s+/g, ''))
  if (solo) return { valor: solo, tipo: 'talla', grupo: 'ropa' }
  const rango = /^([A-Z0-9]+)\s*[-/]\s*([A-Z0-9]+)$/.exec(u)
  if (rango) {
    const a = ropaToken(rango[1]), b = ropaToken(rango[2])
    if (a && b) return { valor: `${a}/${b}`, tipo: 'talla', grupo: 'ropa' }
  }

  if (new RegExp(`^${NUM}$`).test(sinPrefijo)) {
    const n = numeroTalla(sinPrefijo)
    const entero = Number.isInteger(n)
    if (n >= 34 && n <= 50) return { valor: `EU ${limpio(sinPrefijo)}`, tipo: 'talla', grupo: 'calzado' }
    if (contexto.calzado && n >= 17 && n <= 52) return { valor: `EU ${limpio(sinPrefijo)}`, tipo: 'talla', grupo: 'calzado' }
    if (entero && n >= 2 && n <= 16) return { valor: String(n), tipo: 'talla', grupo: 'ninos' }
    return { error: `talla '${raw}' ambigua o fuera de rango: usa EU 34–50 (calzado), 2–16 (niños) o una talla de ropa` }
  }
  return { error: `talla '${raw}' no reconocida` }
}

export const esTallaCanonica = (r: TallaCanonica | TallaError): r is TallaCanonica => !('error' in r)

/**
 * Editor de variantes: solo los tipos Ropa y Calzado (zap-*) guardan talla canónica. "Numérica" (cintura 28–44),
 * colores y personalizada se guardan tal cual. null = este tipo no se canoniza.
 */
export function canonParaTipo(tipo: { id: string; group: string | null }, entrada: string): TallaCanonica | TallaError | null {
  const zap = tipo.group?.startsWith('zap-') ?? false
  if (tipo.id !== 'ropa' && !zap) return null
  return canonizarTalla(entrada, { calzado: zap })
}
