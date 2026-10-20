import { z } from 'zod'
import { FINANCING_BADGES, isFinancingBadgeKey } from '@/lib/financing-badges'
import type { FinancingBadgeKey } from '@/lib/financing-badges'

/**
 * Financiamiento del catálogo público, configurable POR NEGOCIO (business.settings.financing).
 *
 *   elegibilidad efectiva de un producto = financiamiento activado (enabled) Y product.financing_excluded = false
 *
 * Tres modos; Cashea ya NO está cableado, es solo un preset:
 *   cashea → nombre, logo y frase de ejemplo del preset (la frase se puede editar; el logo es el oficial)
 *   other  → otra empresa: nombre obligatorio, logo propio opcional (subido con /api/upload/image type=financing)
 *   own    → financiamiento propio: solo texto (la frase es obligatoria), sin logo
 * Solo servidor y tipos: no depende de la DB.
 */

export const FINANCING_MODES = ['cashea', 'other', 'own'] as const
export type FinancingMode = (typeof FINANCING_MODES)[number]

export const FINANCING_PHRASE_MAX = 80
export const FINANCING_NAME_MAX = 40

export const CASHEA_PRESET = {
  provider_name: 'Cashea',
  phrase:        'Paga en cuotas con Cashea',
  logo_url:      FINANCING_BADGES.cashea.src,
} as const

/** Lo que se guarda en business.settings.financing. */
export interface FinancingConfig {
  enabled:       boolean
  mode:          FinancingMode
  provider_name: string | null
  phrase:        string | null
  logo_url:      string | null
}

/** Lo que ve el público (null = el negocio no tiene financiamiento activado). */
export interface PublicFinancing {
  mode:     FinancingMode
  name:     string | null
  phrase:   string
  logo_url: string | null
}

const DISABLED_DEFAULT: FinancingConfig = {
  enabled: false, mode: 'cashea', ...CASHEA_PRESET,
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  // sin caracteres de control; el texto se pinta siempre como texto (React lo escapa), nunca como HTML
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
  return t === '' ? null : t
}

/** Rutas de logo que el servidor acepta: el preset oficial o un archivo subido por ESTE negocio. */
export function isAllowedLogoUrl(url: string, businessId: number): boolean {
  return url === CASHEA_PRESET.logo_url ||
    new RegExp(`^/storage/tenants/${businessId}/financing/[0-9a-f-]{36}\\.webp$`).test(url)
}

/**
 * Lee la configuración desde settings. Compatibilidad: si no existe settings.financing pero el negocio tenía el
 * sello viejo (settings.catalog_financing_badge = 'cashea'), se interpreta como Cashea activado.
 */
export function readFinancingConfig(settings: unknown, businessId?: number): FinancingConfig {
  const s = isRecord(settings) ? settings : {}
  const f = s.financing
  if (isRecord(f) && typeof f.enabled === 'boolean') {
    const mode: FinancingMode = (FINANCING_MODES as readonly string[]).includes(f.mode as string) ? (f.mode as FinancingMode) : 'cashea'
    const logo = typeof f.logo_url === 'string' && (businessId === undefined ? true : isAllowedLogoUrl(f.logo_url, businessId)) ? f.logo_url : null
    return {
      enabled:       f.enabled,
      mode,
      provider_name: text(f.provider_name, FINANCING_NAME_MAX),
      phrase:        text(f.phrase, FINANCING_PHRASE_MAX),
      logo_url:      mode === 'own' ? null : logo,
    }
  }
  if (isFinancingBadgeKey(s.catalog_financing_badge)) return { enabled: true, mode: 'cashea', ...CASHEA_PRESET }
  return { ...DISABLED_DEFAULT }
}

/** Entrada del PATCH /api/config/catalog (campo `financing`). */
export const financingInputSchema = z.object({
  enabled:       z.boolean(),
  mode:          z.enum(FINANCING_MODES),
  provider_name: z.string().max(200).nullish(),
  phrase:        z.string().max(500).nullish(),
  logo_url:      z.string().max(300).nullish(),
}).strict()
export type FinancingInput = z.infer<typeof financingInputSchema>

export type BuildFinancingResult =
  | { ok: true;  config: FinancingConfig }
  | { ok: false; field: 'provider_name' | 'phrase' | 'logo_url'; error: string }

/** Valida y normaliza la entrada según el modo. Con enabled=false no exige campos (guarda lo que haya). */
export function buildFinancingConfig(input: FinancingInput, businessId: number): BuildFinancingResult {
  const name = text(input.provider_name, FINANCING_NAME_MAX)
  const phrase = text(input.phrase, FINANCING_PHRASE_MAX)
  const logo = typeof input.logo_url === 'string' && input.logo_url.trim() !== '' ? input.logo_url.trim() : null

  if (input.mode === 'cashea') {
    return { ok: true, config: { enabled: input.enabled, mode: 'cashea', provider_name: CASHEA_PRESET.provider_name, phrase: phrase ?? CASHEA_PRESET.phrase, logo_url: CASHEA_PRESET.logo_url } }
  }
  if (input.mode === 'other') {
    if (input.enabled && !name) return { ok: false, field: 'provider_name', error: 'Indica el nombre de la empresa de financiamiento.' }
    if (logo !== null && !isAllowedLogoUrl(logo, businessId)) return { ok: false, field: 'logo_url', error: 'El logo debe subirse desde la configuración (no se aceptan enlaces externos).' }
    return { ok: true, config: { enabled: input.enabled, mode: 'other', provider_name: name, phrase: phrase ?? (name ? `Paga en cuotas con ${name}` : null), logo_url: logo } }
  }
  // own: solo texto
  if (input.enabled && !phrase) return { ok: false, field: 'phrase', error: 'Escribe la frase que verán tus clientes, por ejemplo "Financiamos tu compra en 3 cuotas".' }
  return { ok: true, config: { enabled: input.enabled, mode: 'own', provider_name: null, phrase, logo_url: null } }
}

/** Vista pública del catálogo; null si está desactivado. */
export function toPublicFinancing(cfg: FinancingConfig): PublicFinancing | null {
  if (!cfg.enabled) return null
  return {
    mode:     cfg.mode,
    name:     cfg.provider_name,
    phrase:   cfg.phrase ?? (cfg.provider_name ? `Paga en cuotas con ${cfg.provider_name}` : 'Financiamiento disponible'),
    logo_url: cfg.logo_url,
  }
}

/** Elegibilidad efectiva de un producto. */
export function isFinancingEffective(cfg: FinancingConfig, product: { financing_excluded: boolean }): boolean {
  return cfg.enabled && !product.financing_excluded
}

/**
 * Puente para las fichas que todavía pintan el sello por llave (FinancingBadgeKey): solo el preset Cashea tiene
 * imagen en public/brand. Los modos other/own los pinta la UI nueva con PublicFinancing.
 */
export function legacyBadgeKey(cfg: FinancingConfig, product: { financing_excluded: boolean }): FinancingBadgeKey | null {
  return isFinancingEffective(cfg, product) && cfg.mode === 'cashea' ? 'cashea' : null
}
