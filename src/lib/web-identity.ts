import { cache } from 'react'
import type { Metadata, Viewport } from 'next'
import { prisma } from '@/lib/prisma'
import { cartaPalette } from '@/lib/og/carta-palette'

/**
 * Identidad web por negocio: favicon e imagen para compartir propios. Vive en business.settings (sin cambio de esquema):
 *   web_favicon  "/storage/tenants/{id}/brand/web-favicon-{ts}"  → {base}-32.png, -180.png, -192.png, -512.png
 *   web_og_image "/storage/tenants/{id}/brand/web-og-{ts}"        → {base}.webp y {base}.jpg (1200×630)
 * La ruta guardada se valida contra el id del negocio al leerla: un settings manipulado nunca apunta a otro tenant.
 */

export type IdentityKind = 'favicon' | 'og'
export const FAVICON_SIZES = [32, 180, 192, 512] as const
export const OG_W = 1200
export const OG_H = 630

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,98}$/
const HEX_RE = /^#[0-9a-fA-F]{6}$/

export const settingsKey = (kind: IdentityKind): 'web_favicon' | 'web_og_image' => (kind === 'favicon' ? 'web_favicon' : 'web_og_image')

/** Carpeta del tenant donde viven los archivos (relativa a la raíz del proyecto). */
export const brandDir = (businessId: number): string => `storage/tenants/${businessId}/brand`

/** Nueva base de ruta (única por subida: los navegadores y WhatsApp no sirven un favicon viejo cacheado). */
export const newBase = (businessId: number, kind: IdentityKind): string => `/storage/tenants/${businessId}/brand/web-${kind}-${Date.now()}`

/** Ruta base guardada, solo si es de ESTE negocio y de este tipo. */
export function readBase(settings: unknown, businessId: number, kind: IdentityKind): string | null {
  const v = (settings as Record<string, unknown> | null)?.[settingsKey(kind)]
  return typeof v === 'string' && new RegExp(`^/storage/tenants/${businessId}/brand/web-${kind}-\\d+$`).test(v) ? v : null
}

export const faviconFile = (base: string, size: (typeof FAVICON_SIZES)[number]): string => `${base}-${size}.png`
export const ogFile = (base: string, ext: 'jpg' | 'webp'): string => `${base}.${ext}`

export interface IdentityBusiness {
  id: number
  name: string
  theme_color: string | null
  settings: unknown
  catalog_template: string | null
}

/** Negocio de un catálogo público por slug (una sola consulta por petición: layout y páginas comparten el resultado). */
export const loadIdentityBusiness = cache(async (slug: string): Promise<IdentityBusiness | null> => {
  if (!SLUG_RE.test(slug)) return null
  return prisma.business.findFirst({
    where:  { catalog_slug: slug, catalog_active: true, active: true },
    select: { id: true, name: true, theme_color: true, settings: true, catalog_template: true },
  })
})

/** Color de acento del negocio (theme-color del navegador); null si no hay uno válido. */
export function accentOf(b: IdentityBusiness): string | null {
  if (b.catalog_template === 'carta') return cartaPalette(b.settings).accent
  return b.theme_color && HEX_RE.test(b.theme_color) ? b.theme_color : null
}

/** icons + manifest del negocio para los layouts de catálogo. {} si no subió favicon: queda el de ActivoPOS (layout raíz). */
export async function identityMetadata(slug: string): Promise<Metadata> {
  const b = await loadIdentityBusiness(slug)
  const base = b ? readBase(b.settings, b.id, 'favicon') : null
  if (!b || !base) return {}
  return {
    icons: {
      icon: [
        { url: faviconFile(base, 32), sizes: '32x32', type: 'image/png' },
        { url: faviconFile(base, 192), sizes: '192x192', type: 'image/png' },
      ],
      apple: [{ url: faviconFile(base, 180), sizes: '180x180' }],
    },
    manifest: `/api/web/manifest/${slug}`,
  }
}

export async function identityViewport(slug: string): Promise<Viewport> {
  const b = await loadIdentityBusiness(slug)
  const accent = b ? accentOf(b) : null
  return accent ? { themeColor: accent } : {}
}
