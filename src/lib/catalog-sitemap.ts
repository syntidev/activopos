import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { CATALOG_WHERE_FILTER, isCatalogLive } from '@/lib/catalog'
import { garminGuideEnabled } from '@/lib/garmin-guide'
import { normalizeTemplate } from '@/lib/plantillas'

/**
 * Sitemap de UN catálogo público (portada, tienda, categorías con productos, fichas visibles, guía y páginas legales).
 * Lo usan el dominio propio (URLs limpias) y activopos.com/c/<slug> (URLs canónicas): cada uno pasa su `toUrl`, que convierte la
 * ruta nativa (''; '/productos'; '/p/5'; '/privacidad'; '/productos?categoria=X') en la URL absoluta de su host (o null si no existe ahí).
 * Las fichas con catalog_visibility = 'hidden' nunca entran (CATALOG_WHERE_FILTER).
 */

const MAX_PRODUCTS = 5000

export async function catalogSitemap(slug: string, toUrl: (nativeSuffix: string) => string | null, kitUrl?: string): Promise<MetadataRoute.Sitemap> {
  const business = await prisma.business.findFirst({
    where:  { catalog_slug: slug, catalog_active: true, active: true },
    select: {
      id: true, updated_at: true, catalog_plan: true, catalog_template: true, subscription_active: true, subscription_expires_at: true, settings: true,
    },
  })
  if (!business || !isCatalogLive(business)) return []
  const template = normalizeTemplate(business.catalog_template)
  const tienda = template !== 'carta'

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where:   { business_id: business.id, active: true, available_in_pos: true, ...CATALOG_WHERE_FILTER },
      select:  { id: true, updated_at: true, category_id: true },
      orderBy: { id: 'asc' },
      take:    MAX_PRODUCTS,
    }),
    tienda ? prisma.category.findMany({ where: { business_id: business.id }, select: { id: true, name: true }, orderBy: { id: 'asc' } }) : Promise.resolve([]),
  ])
  const withProducts = new Set(products.map(p => p.category_id))

  const entry = (suffix: string, lastModified: Date, changeFrequency: 'weekly' | 'monthly' | 'yearly', priority: number): MetadataRoute.Sitemap => {
    const url = toUrl(suffix)
    return url ? [{ url, lastModified, changeFrequency, priority }] : []
  }
  return [
    ...entry('', business.updated_at, 'weekly', 1),
    ...(tienda ? entry('/productos', business.updated_at, 'weekly', 0.9) : []),
    ...categories.filter(c => withProducts.has(c.id)).flatMap(c => entry(`/productos?categoria=${encodeURIComponent(c.name)}`, business.updated_at, 'weekly', 0.6)),
    ...(template === 'premium' && garminGuideEnabled(business.settings) ? entry('/guia/garmin', business.updated_at, 'monthly', 0.6) : []),
    ...(kitUrl ? [{ url: kitUrl, lastModified: business.updated_at, changeFrequency: 'weekly' as const, priority: 0.7 }] : []),
    ...products.flatMap(p => entry(`/p/${p.id}`, p.updated_at, 'weekly', 0.7)),
    ...entry('/privacidad', business.updated_at, 'yearly', 0.3),
    ...entry('/terminos', business.updated_at, 'yearly', 0.3),
  ]
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/** XML del sitemap (mismo formato que genera app/sitemap.ts). */
export function sitemapXml(entries: MetadataRoute.Sitemap): string {
  const items = entries.map(e => {
    const last = e.lastModified ? `<lastmod>${new Date(e.lastModified).toISOString()}</lastmod>` : ''
    return `<url><loc>${esc(e.url)}</loc>${last}${e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : ''}${e.priority !== undefined ? `<priority>${e.priority}</priority>` : ''}</url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items.join('')}</urlset>\n`
}
