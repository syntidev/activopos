import type { Metadata } from 'next'
import { siteOrigin } from './site-url'

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
 * Metadatos para compartir un catálogo/ficha: og:image ABSOLUTA y con dimensiones, og:url, og:type y tarjeta grande de Twitter.
 * `metadataBase` queda fijado al host real, así cualquier otra ruta relativa que Next resuelva también sale absoluta.
 */
export function shareMetadata(i: ShareInput): Metadata {
  const origin = siteOrigin()
  const abs = (p: string): string => `${origin}${p}`
  return {
    metadataBase: new URL(origin),
    title:        i.title,
    description:  i.description,
    ...(i.robots ? { robots: i.robots } : {}),
    openGraph: {
      title:       i.title,
      description: i.description,
      url:         abs(i.path),
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
