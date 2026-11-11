import type { GuideKind, GuideModel } from '@/types/garmin-guide'

/**
 * Guía "Tu Garmin, paso a paso": modelos con guía y helpers de coincidencia producto ↔ modelo.
 * Pasos en garmin-guide-steps.ts; "Saca el máximo provecho" y preguntas frecuentes en garmin-guide-extras.ts.
 */

const M = (family: string, name: string, kind: GuideKind): GuideModel => ({ family, name, kind })

export const GUIDE_MODELS: readonly GuideModel[] = [
  M('Forerunner', 'Forerunner 70', 't'), M('Forerunner', 'Forerunner 170 Music', 't'), M('Forerunner', 'Forerunner 265', 't'),
  M('Forerunner', 'Forerunner 570', 't'), M('Forerunner', 'Forerunner 965', 't'), M('Forerunner', 'Forerunner 970', 't'),
  M('fēnix', 'fēnix 9', 't'), M('Venu', 'Venu X1', 't'),
  M('Instinct', 'Instinct Crossover', 'b'), M('Instinct', 'Instinct Crossover AMOLED', 'b'),
  M('CIRQA', 'CIRQA Smart Band', 's'),
  M('Edge', 'Edge 1050', 'c'), M('Edge', 'Edge 850', 'c'), M('Varia', 'Varia RearVue 820', 'r'), M('Varia', 'Varia RCT715', 'r'),
  M('HRM', 'HRM 600', 'h'), M('HRM', 'HRM 200', 'h'),
  M('Satélite y navegación', 'inReach Mini 3 Plus', 'i'), M('Satélite y navegación', 'GPSMAP H1i Plus', 'g'),
  M('Otro', 'Otro modelo con pantalla táctil', 't'), M('Otro', 'Otro modelo solo con botones', 'b'),
]

export const GUIDE_FAMILIES: readonly string[] = GUIDE_MODELS.reduce<string[]>((acc, m) => (acc.includes(m.family) ? acc : [...acc, m.family]), [])

/** Duración aproximada que se anuncia en la cabecera de la guía. */
export const GUIDE_MINUTES = 15

export const garminGuideEnabled = (settings: unknown): boolean =>
  ((settings ?? {}) as Record<string, unknown>).garmin_guide === true

export const isGarminBrand = (name: string | null | undefined): boolean => (name ?? '').trim().toLowerCase() === 'garmin'

/** Compara nombres sin ruido: sin acentos (fēnix = fenix), sin ® ™, sin la marca "Garmin", en minúsculas y con espacios simples. */
const plain = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[®™©]/g, ' ').replace(/\bgarmin\b/g, ' ').replace(/\s+/g, ' ').trim()

/** Modelo de la guía cuyo nombre está contenido en `text` (el más largo gana); null si ninguno. */
export function matchModelIndex(text: string): number | null {
  const t = plain(text)
  let best: number | null = null
  GUIDE_MODELS.forEach((m, i) => {
    if (m.family === 'Otro' || !t.includes(plain(m.name))) return
    if (best === null || m.name.length > GUIDE_MODELS[best].name.length) best = i
  })
  return best
}

/** Primera foto de la lista JSON de imágenes de un producto. */
export function firstImage(raw: string | null): string | null {
  if (!raw) return null
  try {
    const list: unknown = JSON.parse(raw)
    return Array.isArray(list) && typeof list[0] === 'string' ? list[0] : null
  } catch { return null }
}
