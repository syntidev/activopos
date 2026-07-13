import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

// Prefijos públicos — todos con slash final para evitar bypass tipo /catalogo-admin
const PUBLIC_PREFIXES = [
  '/login',
  '/registro',
  '/api/auth/',
  '/catalogo/',
  '/api/catalog/',
  '/api/public/',
  '/api/marketing/',                      // contenido público de marketing (planes, segmentos)
  '/para-',                               // landings SEO por segmento (/para-carniceria, etc.) — públicas
  '/blog/',                               // posts individuales del blog público (/blog está en PUBLIC_EXACT)
  '/api/blog',                            // endpoint público del blog — server fetch propio no reenvía cookies

  '/api/r/',                              // descarga pública de reportes por token
  '/api/onboarding/',
]

// Rutas exactas públicas — no usan startsWith
const PUBLIC_EXACT = new Set([
  '/',
  '/recursos',
  '/segmentos',
  '/blog',
  '/faq',
  '/soporte',
  '/contacto',
  '/nosotros',
  '/planes',
  '/legal',
  '/privacidad',
  '/terminos',
  '/landing.html',
  '/sitemap.xml',
  '/robots.txt',
  '/llms.txt',
  '/catalogo',                         // landing sin slug — fallback público, no requiere auth
  '/api/reports/monthly/pending',        // n8n: lista pending (x-api-key)
  '/api/reports/monthly/mark-pending',   // n8n: marca todos como pending (x-api-key)
  '/api/reports/monthly/mark-notified',  // n8n: marca notificado + guarda wa_url (x-api-key)
])

// Segmentos top-level de rutas protegidas conocidas — (dashboard), (admin) y /api/*.
// Cualquier ruta que NO matchee público NI esta lista es desconocida para el
// sistema: se deja pasar (NextResponse.next) para que Next.js resuelva el 404
// nativo en vez de redirigir a /login (evita el soft-404 loop que desperdicia
// crawl budget de Google). Si agregas una carpeta nueva bajo (dashboard) o
// (admin), agrégala aquí también.
const PROTECTED_PREFIXES = [
  '/analytics', '/ayuda', '/caja', '/catalogo-digital', '/clientes', '/configuracion',
  '/cotizaciones', '/devoluciones', '/escritorio', '/finanzas', '/inventario', '/kds',
  '/onboarding', '/pedidos', '/pos', '/productos', '/proveedores', '/reportes',
  '/tu-dia', '/usuarios', '/ventas',
  '/admin', '/blog-admin', '/businesses', '/invoices', '/settings', '/stats', '/tickets',
  '/api/',
]

// URLs del route-group (admin): /businesses y /stats no viven bajo /admin,
// así que se listan explícitamente para que el middleware las cubra (defense-in-depth)
const SUPER_ADMIN_ONLY = [
  '/admin',
  '/api/admin',
  '/businesses',
  '/stats',
]

const ADMIN_ONLY = [
  '/onboarding',
  '/configuracion',
  '/finanzas',
  '/api/reports',
  '/reportes',
  '/analytics',
  '/api/analytics',
  '/api/quotations',
  '/cotizaciones',
  '/devoluciones',
  '/usuarios',
  '/api/returns',
  '/api/users',
  '/productos',
  '/proveedores',
  '/inventario',
]


export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rutas exactas (raíz, landing estático)
  if (PUBLIC_EXACT.has(pathname)) {
    return NextResponse.next()
  }

  // Activos estáticos y tasa pública
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/rates') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/uploads/')
  ) {
    return NextResponse.next()
  }

  // Prefijos públicos (login, catálogo, auth API)
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Ruta desconocida (no pública, no protegida conocida) — deja que Next.js
  // resuelva el 404 nativo. NUNCA redirect a /login para rutas inexistentes.
  if (!PROTECTED_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get('activopos_session')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const session = await verifyToken(token)

  if (!session) {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete('activopos_session')
    return res
  }

  if (SUPER_ADMIN_ONLY.some(p => pathname.startsWith(p))) {
    if (session.role !== 'super_admin') {
      return NextResponse.redirect(new URL('/escritorio', req.url))
    }
  }

  if (ADMIN_ONLY.some(p => pathname.startsWith(p))) {
    if (session.role === 'cashier') {
      return NextResponse.redirect(new URL('/pos', req.url))
    }
  }

  // Onboarding redirect — admin only, from dashboard root
  if (
    session.role === 'admin' &&
    session.onboardingCompleted === false &&
    pathname === '/escritorio' &&
    !pathname.startsWith('/onboarding')
  ) {
    return NextResponse.redirect(new URL('/onboarding', req.url))
  }

  const res = NextResponse.next()
  res.headers.set('x-user-id', String(session.userId))
  res.headers.set('x-business-id', String(session.businessId))
  res.headers.set('x-user-role', session.role)
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon-96x96.png|favicon.svg|apple-touch-icon.png|site.webmanifest|activopos-logo-icon.svg|activopos-logo-flat-positive.svg|activopos-logo-flat-positive.png|activopos-logo-adaptive.svg|web-app-manifest-192x192.png|web-app-manifest-512x512.png|og-image.png).*)'],
}
