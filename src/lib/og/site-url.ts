import { headers } from 'next/headers'
import { getCustomDomains, normalizeHost, requestHost, type CustomDomain } from '@/lib/custom-domains'

/**
 * Origen ABSOLUTO CANÓNICO del sitio: canonical, og:url, og:image, JSON-LD, sitemap y robots. Sin él Next resuelve las rutas relativas
 * contra `http://localhost:<puerto>` y WhatsApp/Facebook no pueden descargar la imagen.
 *
 * El host de la petición NUNCA se refleja tal cual (un `Host` falso envenenaría las respuestas cacheadas): solo se devuelve
 * `https://<host>` si, sin "www." y en minúsculas, es activopos.com o un dominio propio de CUSTOM_DOMAINS. Cualquier otro host → https://activopos.com.
 * www.<dominio> y <dominio> comparten el mismo origen canónico (el apex).
 * Excepción de DESARROLLO (NODE_ENV ≠ production): localhost y direcciones internas se devuelven tal cual (`http://localhost:3001`) para poder probar.
 */
const APP_HOST = 'activopos.com'
export const APP_ORIGIN = `https://${APP_HOST}`
const DEV_HOST_RE = /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2})(?::\d{1,5})?$/

export interface OriginOptions {
  /** Por defecto NODE_ENV === 'production'. Se pasa explícito para probar la regla de producción. */
  production?: boolean
  /** Por defecto los dominios de CUSTOM_DOMAINS. */
  domains?: readonly CustomDomain[]
}

export function catalogOrigin(rawHost: string | null | undefined, opts: OriginOptions = {}): string {
  const production = opts.production ?? process.env.NODE_ENV === 'production'
  const host = normalizeHost(rawHost).replace(/^www\./, '')
  if (host === APP_HOST || (opts.domains ?? getCustomDomains()).some(d => d.host === host)) return `https://${host}`
  const first = (rawHost ?? '').split(',')[0].trim().toLowerCase()
  if (!production && DEV_HOST_RE.test(first)) return `http://${first}`
  return APP_ORIGIN
}

/** Origen canónico para la petición en curso (host real en producción; en desarrollo también x-forwarded-host, ver requestHost). */
export function siteOrigin(): string {
  const h = headers()
  return catalogOrigin(requestHost(name => h.get(name)))
}
