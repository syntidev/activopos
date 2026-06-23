import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

// Prefijos públicos — todos con slash final para evitar bypass tipo /catalogo-admin
const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth/',
  '/catalogo/',
  '/api/catalog/',
  '/api/r/',                              // descarga pública de reportes por token
  '/api/onboarding/',
]

// Rutas exactas públicas — no usan startsWith
const PUBLIC_EXACT = new Set([
  '/',
  '/landing.html',
  '/api/reports/monthly/pending',      // n8n: lista pending (x-api-key)
  '/api/reports/monthly/mark-pending', // n8n: marca todos como pending (x-api-key)
])

const SUPER_ADMIN_ONLY = [
  '/admin',
  '/api/admin',
]

const ADMIN_ONLY = [
  '/onboarding',
  '/configuracion',
  '/finanzas',
  '/api/reports',
  '/analytics',
  '/api/analytics',
  '/api/quotations',
  '/cotizaciones',
  '/devoluciones',
  '/usuarios',
  '/api/returns',
  '/api/users',
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
