import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const BASE = 'https://activopos.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const segments = await prisma.segment.findMany({
    where:  { active: true },
    select: { slug: true, created_at: true },
  })

  const segmentUrls: MetadataRoute.Sitemap = segments.map(s => ({
    url:             `${BASE}/para-${s.slug}`,
    lastModified:    s.created_at,
    changeFrequency: 'monthly',
    priority:        0.8,
  }))

  const now = new Date()

  // Solo rutas públicas que existen realmente en (marketing) + /registro.
  const staticUrls: MetadataRoute.Sitemap = [
    { url: BASE,                  lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/nosotros`,    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/faq`,         lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/soporte`,     lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/contacto`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${BASE}/registro`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.7 },
    { url: `${BASE}/privacidad`,  lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terminos`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]

  return [...staticUrls, ...segmentUrls]
}
