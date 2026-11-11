import type { Metadata } from 'next'
import { siteOrigin } from './site-url'
import { currentCustomDomain } from '@/lib/catalog-links-server'
import { nativeToClean } from '@/lib/custom-domains'

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

/** `/c/<slug>[/p/5…]` → su ruta limpia si la petición llega por el dominio propio de ese tenant; si no, la misma ruta. */
function publicPath(path: string): string {
  const d = currentCustomDomain()
  const m = d ? /^\/c\/([^/?#]+)(.*)$/.exec(path) : null
  if (!d || !m || m[1] !== d.slug) return path
  return nativeToClean(d.kind, m[2] || '') ?? path
}

/**
 * Metadatos para compartir un catálogo/ficha: og:image ABSOLUTA y con dimensiones, og:url, og:type y tarjeta grande de Twitter.
 * `metadataBase` queda fijado al host real, así cualquier otra ruta relativa que Next resuelva también sale absoluta.
 */
export function shareMetadata(i: ShareInput): Metadata {
  const origin = siteOrigin()
  const abs = (p: string): string => `${origin}${p}`
  // En un dominio propio, la URL pública y el canonical son la ruta LIMPIA (/p/5, /tienda…), no la canónica /c/<slug>/….
  const pageUrl = abs(publicPath(i.path))
  return {
    metadataBase: new URL(origin),
    title:        i.title,
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
