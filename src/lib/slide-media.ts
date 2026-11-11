// Datos de imagen de un slide/portada: punto de enfoque, imagen móvil opcional y dónde mostrarla.
// Viven dentro del JSON del slide (landing_sections.config) y en settings.carta_cover_meta: sin cambio de esquema.

export const SHOW_ON = ['all', 'desktop', 'mobile'] as const
export type ShowOn = (typeof SHOW_ON)[number]

/** Punto medio por defecto del enfoque (%). */
export const DEFAULT_FOCUS = 50
/** Móvil = hasta 640 px, igual que el resto del catálogo. */
export const MOBILE_QUERY = '(max-width: 640px)'
/** Medidas recomendadas (px) para subir: escritorio 1920×800, móvil 1080×1350 (4:5). */
export const RECOMMENDED = { desktop: { w: 1920, h: 800 }, mobile: { w: 1080, h: 1350 } } as const

export interface SlideMedia {
  /** Imagen de escritorio (la principal). */
  src:     string
  /** Imagen móvil opcional (4:5). */
  mobile:  string | null
  focusX:  number
  focusY:  number
  showOn:  ShowOn
}

export const clampFocus = (v: unknown): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_FOCUS
  return Math.min(100, Math.max(0, Math.round(n)))
}

export const readShowOn = (v: unknown): ShowOn => ((SHOW_ON as readonly string[]).includes(v as string) ? (v as ShowOn) : 'all')

/** Arma los datos de imagen desde cualquier objeto con los campos opcionales (slide o cover_meta). */
export function mediaOf(src: string, extra: { mobile_path?: unknown; focus_x?: unknown; focus_y?: unknown; show_on?: unknown } | null | undefined): SlideMedia {
  const mobile = typeof extra?.mobile_path === 'string' && extra.mobile_path.trim() ? extra.mobile_path : null
  return { src, mobile, focusX: clampFocus(extra?.focus_x), focusY: clampFocus(extra?.focus_y), showOn: readShowOn(extra?.show_on) }
}

/** ¿Se muestra en este viewport? `isMobile` null = aún no se sabe (SSR): se muestran todas y el CSS oculta. */
export const isVisibleOn = (showOn: ShowOn, isMobile: boolean | null): boolean =>
  isMobile === null || showOn === 'all' || (showOn === 'mobile' ? isMobile : !isMobile)

/** object-position a partir del enfoque. */
export const objectPositionOf = (m: Pick<SlideMedia, 'focusX' | 'focusY'>): string => m.focusX + '% ' + m.focusY + '%'
