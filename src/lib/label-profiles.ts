/**
 * Perfiles de marca de la captura de etiquetas — reglas puras compartidas entre cliente y servidor.
 * Cada marca es un dato (patrón de referencia, regla de tallas, campos del OCR, metas); el código no
 * ramifica por nombre de marca. Sin imports de servidor: este módulo se bundlea al cliente.
 */
import { REF_RE, SIZES, isValidEan13 } from '@/lib/label-capture-shared'
import type { LabelCaptureDTO, LabelProfileId } from '@/types/label-capture'

export interface LabelProfile {
  id: LabelProfileId
  name: string
  /** Patrón de la referencia/estilo de la etiqueta. */
  refPattern: RegExp
  /** Lista cerrada de tallas, o null si la talla se arma con sistemas numéricos (US/EU/UK/JP). */
  sizeList: readonly string[] | null
  /** Campos que el OCR debe extraer. */
  ocrFields: readonly string[]
  /** Metas de conteo opcionales. */
  goals: { variants: number; units: number } | null
}

export const ON_STYLE_RE = /^(3[MW][A-Z]\d{4})(\d{4})$/

export const LABEL_PROFILES: Record<LabelProfileId, LabelProfile> = {
  safetti: {
    id: 'safetti',
    name: 'Safetti',
    refPattern: REF_RE,
    sizeList: SIZES,
    ocrFields: ['ref', 'modelo', 'talla'],
    // 27 productos Safetti: 61 variantes, 66 unidades.
    goals: { variants: 61, units: 66 },
  },
  on: {
    id: 'on',
    name: 'On',
    refPattern: ON_STYLE_RE,
    sizeList: null,
    ocrFields: ['estilo', 'modelo', 'colorway', 'genero', 'us', 'eu', 'uk', 'jp'],
    goals: null,
  },
}

export const PROFILE_LIST: readonly LabelProfile[] = [LABEL_PROFILES.safetti, LABEL_PROFILES.on]
export const DEFAULT_PROFILE: LabelProfileId = 'safetti'

export function isProfileId(value: unknown): value is LabelProfileId {
  return value === 'safetti' || value === 'on'
}

/* ── Perfil On ── */

/** Mayúsculas y sin separadores: "3md1011 0001" → "3MD10110001". */
export function normalizeOnStyle(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24)
}

/** grupo 1 = modelo base + género; grupo 2 = código de color. null si el estilo no calza. */
export function parseOnStyle(style: string): { base: string; color: string } | null {
  const m = ON_STYLE_RE.exec(style)
  return m ? { base: m[1], color: m[2] } : null
}

/** 'M' | 'W' de la etiqueta ("Men", "W", "women"…), o ''. */
export function normalizeGender(raw: string): 'M' | 'W' | '' {
  const up = raw.trim().toUpperCase()
  if (up === 'M' || up.startsWith('MEN') || up === 'MALE') return 'M'
  if (up === 'W' || up.startsWith('WOMEN') || up === 'FEMALE') return 'W'
  return ''
}

const SHOE_SIZE_RE = /^\d{1,2}(\.\d)?( \d\/\d)?$/

/** Talla de calzado ("9", "42.5", "42 2/3") sin el prefijo del sistema, o '' si no es una talla. */
export function normalizeShoeSize(raw: string): string {
  const clean = raw.trim().toUpperCase().replace(/^(US|EU|UK|JP)\s*/, '').replace(',', '.').replace(/\s+/g, ' ')
  return SHOE_SIZE_RE.test(clean) ? clean : ''
}

/** Valor de la variante: "US 9 · EU 42.5" (solo los sistemas presentes). */
export function onVariantValue(us: string, eu: string): string {
  return [us && `US ${us}`, eu && `EU ${eu}`].filter(Boolean).join(' · ')
}

export interface OnEvaluation {
  status: 'ok' | 'review'
  reasons: string[]
}

/**
 * Reglas de estado del perfil On. Nada se rechaza: cualquier incumplimiento deja la captura
 * en 'review' con el motivo. El estilo que no calza se guarda completo tal como se leyó.
 */
export function evaluateOn(input: { ean: string; style: string; gender: string; us: string; eu: string }): OnEvaluation {
  const reasons: string[] = []
  if (!isValidEan13(input.ean)) reasons.push('EAN inválido')
  const parsed = parseOnStyle(input.style)
  if (!parsed) reasons.push('estilo con formato inesperado')
  if (!input.gender) reasons.push('género de la etiqueta vacío')
  else if (parsed && input.gender !== parsed.base[1]) reasons.push('género de la etiqueta no coincide con el estilo')
  if (!input.us && !input.eu) reasons.push('talla vacía')
  return { status: reasons.length ? 'review' : 'ok', reasons }
}

export interface OnProductGroup {
  /** Estilo completo (modelo + género + color); '' se agrupa como "sin estilo". */
  style: string
  model_name: string
  colorway: string
  gender: string
  review: boolean
  variants: LabelCaptureDTO[]
}

/** Producto = estilo completo; variante = una captura (un EAN). Mantiene el orden de aparición. */
export function groupOnProducts(items: readonly LabelCaptureDTO[]): OnProductGroup[] {
  const groups = new Map<string, OnProductGroup>()
  for (const item of items) {
    const group = groups.get(item.style)
    if (group) {
      group.variants.push(item)
      group.review = group.review || item.status === 'review'
    } else {
      groups.set(item.style, {
        style: item.style,
        model_name: item.model_name,
        colorway: item.label_color,
        gender: item.gender,
        review: item.status === 'review',
        variants: [item],
      })
    }
  }
  return Array.from(groups.values())
}
