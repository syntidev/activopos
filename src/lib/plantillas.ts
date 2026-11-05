import { z } from 'zod'

/**
 * Plantillas del catálogo público por negocio (las elige el superadmin en el panel).
 *
 *  - La plantilla vive en la columna `businesses.catalog_template` ('generic' | 'premium' | 'carta'); no hay `settings.catalog_template`.
 *  - La plantilla Carta (la construye otra rama) lee `settings.carta_preset` / `carta_style`: aquí solo se escriben esas claves.
 *  - UNA sola URL pública por negocio: `/c/[slug]` (ver app/c/[slug]/[[...rest]]/route.ts). Cambiar de plantilla no cambia el
 *    enlace del cliente; las rutas viejas (/catalogo, /catalogo-premium, /catalogo-carta) siguen funcionando tal cual.
 */

export const TEMPLATES = ['generic', 'premium', 'carta'] as const
export type PlantillaKey = (typeof TEMPLATES)[number]

export const TEMPLATE_LABELS: Record<PlantillaKey, string> = { generic: 'Genérica', premium: 'Premium', carta: 'Carta' }

/** Ruta base de cada plantilla (la home y la ficha cuelgan de ahí, con el mismo slug). */
const BASE_PATH: Record<PlantillaKey, string> = { generic: '/catalogo', premium: '/catalogo-premium', carta: '/catalogo-carta' }

export interface CartaPresetOption { key: string; label: string; available: boolean }

/** Presets de la Carta. Los que aún no existen en el código quedan deshabilitados ("Próximamente"). */
export const CARTA_PRESET_OPTIONS: readonly CartaPresetOption[] = [
  { key: 'brasa', label: 'Brasa', available: true },
  { key: 'noche', label: 'Noche', available: true },
  { key: 'cafe',  label: 'Café',  available: false },
  { key: 'mar',   label: 'Mar',   available: false },
  { key: 'verde', label: 'Verde', available: false },
]
export const AVAILABLE_CARTA_PRESETS = ['brasa', 'noche'] as const
export type CartaPresetKey = (typeof AVAILABLE_CARTA_PRESETS)[number]

export const CARTA_STYLES = ['casual', 'fine'] as const
export type CartaStyleKey = (typeof CARTA_STYLES)[number]

export const SLUG_RE = /^[a-z0-9-]{3,50}$/

export function normalizeTemplate(value: unknown): PlantillaKey {
  return value === 'premium' || value === 'carta' ? value : 'generic'
}

export const templateBasePath = (template: PlantillaKey): string => BASE_PATH[template]

/** El único enlace que se le da al cliente. */
export const publicPath = (slug: string): string => `/c/${slug}`

/** Entrada del superadmin para elegir plantilla. Estricto; carta_* solo con plantilla carta. */
export const plantillaInputSchema = z.strictObject({
  template:     z.enum(TEMPLATES),
  carta_preset: z.enum(AVAILABLE_CARTA_PRESETS).optional(),
  carta_style:  z.enum(CARTA_STYLES).optional(),
}).refine(d => d.template === 'carta' || (d.carta_preset === undefined && d.carta_style === undefined), {
  message: 'carta_preset y carta_style solo aplican a la plantilla carta',
  path:    ['template'],
})
export type PlantillaInput = z.infer<typeof plantillaInputSchema>

export interface PlantillaState { template: PlantillaKey; carta_preset: CartaPresetKey; carta_style: CartaStyleKey }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Lo guardado hoy (con los mismos valores por defecto que usa la plantilla Carta). */
export function readPlantilla(business: { catalog_template?: string | null; settings: unknown }): PlantillaState {
  const s = isRecord(business.settings) ? business.settings : {}
  const preset = (AVAILABLE_CARTA_PRESETS as readonly string[]).includes(s.carta_preset as string) ? (s.carta_preset as CartaPresetKey) : 'brasa'
  const style = (CARTA_STYLES as readonly string[]).includes(s.carta_style as string)
    ? (s.carta_style as CartaStyleKey)
    : preset === 'noche' ? 'fine' : 'casual'
  return { template: normalizeTemplate(business.catalog_template), carta_preset: preset, carta_style: style }
}

/**
 * Settings resultantes. Con carta se escriben carta_preset/carta_style; con otra plantilla NO se borran (si vuelven a Carta
 * conservan lo elegido). El resto de `settings` pasa intacto.
 */
export function applyPlantillaToSettings(settings: unknown, input: PlantillaInput): Record<string, unknown> {
  const base = isRecord(settings) ? { ...settings } : {}
  if (input.template !== 'carta') return base
  const current = readPlantilla({ catalog_template: 'carta', settings })
  const preset = input.carta_preset ?? current.carta_preset
  const defaultStyle: CartaStyleKey = preset === 'noche' ? 'fine' : 'casual'
  return { ...base, carta_preset: preset, carta_style: input.carta_style ?? (input.carta_preset ? defaultStyle : current.carta_style) }
}
