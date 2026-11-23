/**
 * SEO y analítica por negocio. Vive en business.settings (JSON, sin cambio de esquema):
 *   seo_title (≤60) · seo_description (≤160) · ga4_id ("G-XXXXXXXX") · gsc_verification (token de Search Console).
 * Los dos identificadores se validan con regex al GUARDAR y otra vez al LEER: lo que no cumple nunca llega al HTML
 * (el ID de GA4 se interpola en un <script>: sin esta validación sería inyección de scripts).
 */

export const SEO_TITLE_MAX = 60
export const SEO_DESC_MAX = 160
export const GA4_RE = /^G-[A-Z0-9]{6,12}$/
export const GSC_RE = /^[A-Za-z0-9_-]{20,100}$/

export interface SeoSettings {
  seo_title:        string | null
  seo_description:  string | null
  ga4_id:           string | null
  gsc_verification: string | null
}

export const SEO_KEYS = ['seo_title', 'seo_description', 'ga4_id', 'gsc_verification'] as const

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.replace(/\s+/g, ' ').trim()
  return t && t.length <= max ? t : null
}
const matching = (v: unknown, re: RegExp): string | null => (typeof v === 'string' && re.test(v.trim()) ? v.trim() : null)

export function readSeo(settings: unknown): SeoSettings {
  const s = (settings ?? {}) as Record<string, unknown>
  return {
    seo_title:        text(s.seo_title, SEO_TITLE_MAX),
    seo_description:  text(s.seo_description, SEO_DESC_MAX),
    ga4_id:           matching(s.ga4_id, GA4_RE),
    gsc_verification: matching(s.gsc_verification, GSC_RE),
  }
}

/** title = seo_title ?? el actual; description = seo_description ?? la actual. */
export function withSeo<T extends { title: string; description: string }>(input: T, settings: unknown): T {
  const seo = readSeo(settings)
  return { ...input, title: seo.seo_title ?? input.title, description: seo.seo_description ?? input.description }
}
