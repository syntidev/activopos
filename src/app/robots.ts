import { MetadataRoute } from 'next'
import { currentCustomDomain } from '@/lib/catalog-links-server'

// Las rutas del dashboard viven bajo el route-group (dashboard) — invisible en la
// URL — y ya están tras autenticación, así que no son rastreables. Basta bloquear
// las APIs y el login para no gastar presupuesto de crawl.
//
// Bots de IA: indexación permitida (ClaudeBot, GPTBot, Google-Extended, Amazonbot,
// Applebot-Extended) para que el producto sea citable en respuestas de IA. Bots de
// scraping masivo para entrenamiento sin atribución quedan bloqueados (Bytespider,
// CCBot).
export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
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
    sitemap: 'https://activopos.com/sitemap.xml',
    host:    'https://activopos.com',
  }
}
