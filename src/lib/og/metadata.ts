import type { Metadata } from 'next'
import { siteOrigin } from './site-url'
import { currentCustomDomain } from '@/lib/catalog-links-server'
import { getCustomDomains, nativeToClean } from '@/lib/custom-domains'

/** Tamaño fijo de la tarjeta (el estándar de Open Graph / WhatsApp). */
export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

export interface ShareInput {
  title:       string
  description: string
  /** Ruta pública que se comparte (ej. /c/onbike/p/1306): es el og:url. */
  path:        string
  /** Ruta de la imagen generada (ej. /api/og/producto/onbike/1306?v=1760900000000). */
  imagePath:   string
  imageAlt:    string
  kind:        'product' | 'website'
  robots?:     string
}

/**
 * URL pública CANÓNICA de `/c/<slug>[/p/5…]`. Si el tenant tiene dominio propio, es SIEMPRE la ruta limpia en ese dominio, también
 * cuando la petición llega por activopos.com/c/<slug> (evita contenido duplicado); si no, el host de la petición con la misma ruta.
 */
function canonicalUrl(origin: string, path: string): string {
  const m = /^\/c\/([^/?#]+)(.*)$/.exec(path)
  const d = m ? (currentCustomDomain() ?? getCustomDomains().find(x => x.slug === m[1])) : undefined
  const clean = m && d && m[1] === d.slug ? nativeToClean(d.kind, m[2] || '') : null
  return d && clean !== null ? `https://${d.host}${clean}` : `${origin}${path}`
}

/** URL canónica absoluta de una ruta `/c/<slug>…` para esta petición (canonical, og:url y url del JSON-LD). */
export const publicUrl = (path: string): string => canonicalUrl(siteOrigin(), path)

/**
 * Metadatos para compartir un catálogo/ficha: og:image ABSOLUTA y con dimensiones, og:url, og:type y tarjeta grande de Twitter.
 * `metadataBase` queda fijado al host real, así cualquier otra ruta relativa que Next resuelva también sale absoluta.
 */
export function shareMetadata(i: ShareInput): Metadata {
  const origin = siteOrigin()
  const abs = (p: string): string => `${origin}${p}`
  // En un dominio propio, la URL pública y el canonical son la ruta LIMPIA (/p/5, /tienda…), no la canónica /c/<slug>/….
  const pageUrl = canonicalUrl(origin, i.path)
  return {
    metadataBase: new URL(origin),
    // En un dominio propio el título es el del negocio, sin el sufijo "| ActivoPOS" del layout raíz.
    title:        currentCustomDomain() ? { absolute: i.title } : i.title,
    description:  i.description,
    alternates:   { canonical: pageUrl },
    ...(i.robots ? { robots: i.robots } : {}),
    openGraph: {
      title:       i.title,
      description: i.description,
      url:         pageUrl,
      // Next 14 lanza "Invalid OpenGraph type: product" (solo acepta website/article/…): el tipo producto sale por `other`.
      ...(i.kind === 'website' ? { type: 'website' as const } : {}),
      images:      [{ url: abs(i.imagePath), width: OG_WIDTH, height: OG_HEIGHT, type: 'image/jpeg', alt: i.imageAlt }],
    },
    ...(i.kind === 'product' ? { other: { 'og:type': 'product' } } : {}),
    twitter: {
      card:        'summary_large_image',
      title:       i.title,
      description: i.description,
      images:      [abs(i.imagePath)],
    },
  }
}
