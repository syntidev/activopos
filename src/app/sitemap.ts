export const dynamic = 'force-dynamic'
import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { CATALOG_WHERE_FILTER, isCatalogLive } from '@/lib/catalog'
import { currentCustomDomain } from '@/lib/catalog-links-server'
import { KIT_CLEAN, type CustomDomain } from '@/lib/custom-domains'
import { garminGuideEnabled } from '@/lib/garmin-guide'
import { parseKitConfig } from '@/lib/kit-config'

const BASE = 'https://activopos.com'

/** Sitemap de un dominio propio: SOLO las rutas públicas de ese tenant (inicio, tienda, fichas, guía y kit si están activos). */
async function tenantSitemap(domain: CustomDomain): Promise<MetadataRoute.Sitemap> {
  const business = await prisma.business.findFirst({
    where:  { catalog_slug: domain.slug, catalog_active: true, active: true },
    select: {
      id: true, updated_at: true, catalog_plan: true, subscription_active: true, subscription_expires_at: true,
      settings: true, kit200k_config: true,
    },
  })
  if (!business || !isCatalogLive(business)) return []
  const base = `https://${domain.host}`
  const products = await prisma.product.findMany({
    where:   { business_id: business.id, active: true, available_in_pos: true, ...CATALOG_WHERE_FILTER },
    select:  { id: true, updated_at: true },
    orderBy: { id: 'asc' },
    take:    5000,
  })
  const premium = domain.kind === 'premium'
  return [
    { url: `${base}/`, lastModified: business.updated_at, changeFrequency: 'weekly', priority: 1 },
    ...(premium ? [{ url: `${base}/tienda`, lastModified: business.updated_at, changeFrequency: 'weekly' as const, priority: 0.9 }] : []),
    ...(premium && garminGuideEnabled(business.settings) ? [{ url: `${base}/guia/garmin`, lastModified: business.updated_at, changeFrequency: 'monthly' as const, priority: 0.6 }] : []),
    ...(premium && parseKitConfig(business.kit200k_config).activo ? [{ url: `${base}${KIT_CLEAN}`, lastModified: business.updated_at, changeFrequency: 'weekly' as const, priority: 0.7 }] : []),
    ...products.map(p => ({ url: `${base}/p/${p.id}`, lastModified: p.updated_at, changeFrequency: 'weekly' as const, priority: 0.7 })),
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const domain = currentCustomDomain()
  if (domain) return tenantSitemap(domain)

  const [segments, posts] = await Promise.all([
    prisma.segment.findMany({
      where:  { active: true },
      select: { slug: true, created_at: true },
    }),
    prisma.blogPost.findMany({
      where:  { status: 'published' },
      select: { slug: true, updated_at: true },
    }),
  ])

  const segmentUrls: MetadataRoute.Sitemap = segments.map(s => ({
    url:             `${BASE}/para-${s.slug}`,
    lastModified:    s.created_at,
    changeFrequency: 'monthly',
    priority:        0.8,
  }))

  const blogUrls: MetadataRoute.Sitemap = posts.map(p => ({
    url:             `${BASE}/blog/${p.slug}`,
    lastModified:    p.updated_at,
    changeFrequency: 'monthly',
    priority:        0.8,
  }))

  // Fecha del ultimo cambio real de contenido, NO build time: con new Date()
  // cada deploy movia el lastmod de todas las paginas aunque nada cambiara, y
  // los crawlers terminan ignorando la senal. Actualizar a mano al editar
  // contenido de estas paginas.
  const CONTENT_UPDATED = '2026-07-19'

  // Solo rutas públicas que existen realmente en (marketing) + /registro.
  const staticUrls: MetadataRoute.Sitemap = [
    { url: BASE,                    lastModified: CONTENT_UPDATED, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/blog`,          lastModified: CONTENT_UPDATED, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/planes`,        lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/como-funciona`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/segmentos`,     lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/recursos`,      lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/registro`,      lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/nosotros`,      lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/faq`,           lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/soporte`,       lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/contacto`,      lastModified: CONTENT_UPDATED, changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${BASE}/privacidad`,    lastModified: CONTENT_UPDATED, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terminos`,      lastModified: CONTENT_UPDATED, changeFrequency: 'yearly',  priority: 0.3 },
  ]

  return [...staticUrls, ...segmentUrls, ...blogUrls]
}
