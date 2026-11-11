import { NextRequest, NextResponse } from 'next/server'
import { PANEL_ORIGIN, legacyToClean, matchHost, nativeToClean, redirectFlagOn, requestHost, rewriteTarget, getCustomDomains, KIT_CLEAN, KIT_NATIVE } from './custom-domains'

/**
 * Dominios propios en el middleware (Edge, sin DB):
 *  - www.<dominio> → 301 al dominio sin www (host tomado del MAPA, nunca de la petición);
 *  - REWRITE de la ruta limpia a la interna del tenant del mapa; /api, /_next, /storage, /uploads, favicon, robots y sitemap pasan sin tocar;
 *  - panel (dashboard, admin, login, pos, configuración…) → 301 a activopos.com con la misma ruta;
 *  - rutas nativas/legadas del PROPIO tenant (/catalogo-premium/<slug>/…, /c/<slug>/…, /kit-200k) → 301 a su ruta limpia;
 *  - todo lo demás → 404 (ruta inexistente: lo resuelve el not-found de Next, no el panel).
 * Con CUSTOM_DOMAINS_REDIRECT=on, en cualquier OTRO host (activopos.com) las rutas viejas de esos tenants → 301 al dominio propio.
 */

/** Rutas que viven solo en activopos.com (mantener alineada con PROTECTED_PREFIXES de middleware.ts). */
const PANEL_PREFIXES = [
  '/analytics', '/ayuda', '/caja', '/catalogo-digital', '/clientes', '/configuracion', '/cotizaciones', '/devoluciones', '/escritorio',
  '/finanzas', '/inventario', '/kds', '/metricas', '/onboarding', '/pedidos', '/pos', '/productos', '/proveedores', '/reportes',
  '/reservas', '/tu-dia', '/usuarios', '/ventas', '/admin', '/blog-admin', '/businesses', '/invoices', '/settings', '/stats', '/tickets',
  '/login', '/registro',
]

/** Pasan sin tocar en un dominio propio (el catálogo las necesita tal cual). */
const PASS_PREFIXES = ['/api/', '/_next/', '/storage/', '/uploads/', '/icons/', '/fonts/']
const PASS_EXACT = new Set(['/favicon.ico', '/favicon.svg', '/favicon-96x96.png', '/robots.txt', '/sitemap.xml', '/site.webmanifest', '/apple-touch-icon.png', '/og-image.png'])

const is = (path: string, prefix: string): boolean => path === prefix || path.startsWith(`${prefix}/`)

function legacyRedirect(pathname: string, search: string): NextResponse | null {
  const domains = getCustomDomains()
  if (pathname === KIT_NATIVE || pathname === `${KIT_NATIVE}/`) {
    const d = domains.find(x => x.kind === 'premium')
    return d ? NextResponse.redirect(`https://${d.host}${KIT_CLEAN}${search}`, 301) : null
  }
  for (const d of domains) {
    const prefixes = ['/c/', d.kind === 'premium' ? '/catalogo-premium/' : '/catalogo-carta/']
    for (const prefix of prefixes) {
      if (!pathname.startsWith(prefix)) continue
      const [slug, ...tail] = pathname.slice(prefix.length).split('/')
      if (slug !== d.slug) continue
      const clean = nativeToClean(d.kind, tail.length ? `/${tail.join('/')}` : '')
      if (clean) return NextResponse.redirect(`https://${d.host}${clean}${search}`, 301)
    }
  }
  return null
}

export function handleCustomDomains(req: NextRequest): NextResponse | null {
  const { pathname, search } = req.nextUrl
  const match = matchHost(requestHost(name => req.headers.get(name)))

  if (!match) return redirectFlagOn() ? legacyRedirect(pathname, search) : null

  const { domain, www } = match
  if (www) return NextResponse.redirect(`https://${domain.host}${pathname}${search}`, 301)

  // Rutas de paso: NO se cortocircuita el pipeline (null = sigue por las reglas normales de auth y roles del middleware).
  if (PASS_EXACT.has(pathname) || PASS_PREFIXES.some(p => pathname.startsWith(p))) return null
  if (PANEL_PREFIXES.some(p => is(pathname, p))) return NextResponse.redirect(`${PANEL_ORIGIN}${pathname}${search}`, 301)

  const target = rewriteTarget(domain, pathname)
  if (target) {
    const url = req.nextUrl.clone()
    url.pathname = target
    return NextResponse.rewrite(url)
  }

  const clean = legacyToClean(domain, pathname)
  if (clean) return NextResponse.redirect(`https://${domain.host}${clean}${search}`, 301)

  // Fuera del mapa: 404 (ruta que no existe en la app → not-found de Next, nunca el panel).
  const url = req.nextUrl.clone()
  url.pathname = '/dominio-no-encontrado'
  return NextResponse.rewrite(url)
}
