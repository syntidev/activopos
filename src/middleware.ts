import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/api/auth/login']
const ADMIN_ONLY = ['/configuracion', '/finanzas', '/api/reports']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/_next') || pathname.startsWith('/api/rates')) {
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

  if (ADMIN_ONLY.some(p => pathname.startsWith(p))) {
    if (session.role === 'cashier') {
      return NextResponse.redirect(new URL('/pos', req.url))
    }
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
