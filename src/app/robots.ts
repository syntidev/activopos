import { MetadataRoute } from 'next'

// Las rutas del dashboard viven bajo el route-group (dashboard) — invisible en la
// URL — y ya están tras autenticación, así que no son rastreables. Basta bloquear
// las APIs y el login para no gastar presupuesto de crawl.
//
// Bots de IA: indexación permitida (ClaudeBot, GPTBot, Google-Extended, Amazonbot,
// Applebot-Extended) para que el producto sea citable en respuestas de IA. Bots de
// scraping masivo para entrenamiento sin atribución quedan bloqueados (Bytespider,
// CCBot).
export default function robots(): MetadataRoute.Robots {
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
      { userAgent: 'Bytespider',        disallow: '/' },
      { userAgent: 'CCBot',             disallow: '/' },
    ],
    sitemap: 'https://activopos.com/sitemap.xml',
    host:    'https://activopos.com',
  }
}
