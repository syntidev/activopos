import { MetadataRoute } from 'next'

// Las rutas del dashboard viven bajo el route-group (dashboard) — invisible en la
// URL — y ya están tras autenticación, así que no son rastreables. Basta bloquear
// las APIs y el login para no gastar presupuesto de crawl.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow:     '/',
        disallow:  ['/api/', '/login', '/onboarding'],
      },
    ],
    sitemap: 'https://activopos.com/sitemap.xml',
    host:    'https://activopos.com',
  }
}
