import { MetadataRoute } from 'next'
import { currentCustomDomain } from '@/lib/catalog-links-server'
import { prisma } from '@/lib/prisma'
import { isCatalogLive } from '@/lib/catalog'
import { getCustomDomains } from '@/lib/custom-domains'

// Las rutas del dashboard viven bajo el route-group (dashboard) — invisible en la
// URL — y ya están tras autenticación, así que no son rastreables. Basta bloquear
// las APIs y el login para no gastar presupuesto de crawl.
//
// Bots de IA: indexación permitida (ClaudeBot, GPTBot, Google-Extended, Amazonbot,
// Applebot-Extended) para que el producto sea citable en respuestas de IA. Bots de
// scraping masivo para entrenamiento sin atribución quedan bloqueados (Bytespider,
// CCBot).
export const dynamic = 'force-dynamic'

const MAX_CATALOG_SITEMAPS = 300

/** Sitemaps de los catálogos publicados que se sirven por activopos.com/c/<slug> (los que tienen dominio propio anuncian el suyo). */
async function catalogSitemaps(): Promise<string[]> {
  try {
    const own = new Set(getCustomDomains().map(d => d.slug))
    const rows = await prisma.business.findMany({
      where:   { catalog_active: true, active: true, catalog_slug: { not: null } },
      select:  { catalog_slug: true, catalog_plan: true, subscription_active: true, subscription_expires_at: true },
      orderBy: { id: 'asc' },
      take:    MAX_CATALOG_SITEMAPS,
    })
    return rows.filter(r => r.catalog_slug && !own.has(r.catalog_slug) && isCatalogLive(r)).map(r => `https://activopos.com/c/${r.catalog_slug}/sitemap.xml`)
  } catch {
    return []
  }
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Dominio propio de un tenant: solo su catálogo (host del MAPA, no del request); nada del panel ni de activopos.com.
  const domain = currentCustomDomain()
  if (domain) {
    return {
      rules:   [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
      sitemap: `https://${domain.host}/sitemap.xml`,
      host:    `https://${domain.host}`,
    }
  }
  return {
    rules: [
      {
        userAgent: '*',
        allow:     '/',
        disallow:  ['/api/', '/login', '/onboarding', '/_next/'],
      },
      { userAgent: 'ClaudeBot',         allow: '/' },
      { userAgent: 'GPTBot',            allow: '/' },
      { userAgent: 'Google-Extended',   allow: '/' },
      { userAgent: 'Amazonbot',         allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      { userAgent: 'PerplexityBot',     allow: '/' },
      { userAgent: 'Bytespider',        disallow: '/' },
      { userAgent: 'CCBot',             disallow: '/' },
    ],
    sitemap: ['https://activopos.com/sitemap.xml', ...(await catalogSitemaps())],
    host:    'https://activopos.com',
  }
}
