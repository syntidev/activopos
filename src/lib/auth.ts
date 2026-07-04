import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { readImpersonation } from './impersonation'

const rawSecret = process.env.JWT_SECRET
if (!rawSecret) {
  throw new Error('[ActivoPOS] JWT_SECRET env variable is required — set it in .env.local for dev')
}
const SECRET = new TextEncoder().encode(rawSecret)

const COOKIE_NAME = 'activopos_session'
const EXPIRES_IN = '8h'

export interface SessionPayload {
  userId: number
  businessId: number
  role: 'super_admin' | 'admin' | 'cashier'
  name: string
  onboardingCompleted?: boolean
  modulesEnabled?: string
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  const session = await verifyToken(token)
  if (!session) return null

  // Impersonación: solo un super_admin con cookie firmada válida ve su businessId
  // sobrescrito hacia el tenant objetivo. Cualquier otro rol ignora la cookie
  // (fail-closed: una cookie forjada nunca cambia el scope de un no-super_admin).
  if (session.role === 'super_admin') {
    const imp = await readImpersonation()
    if (imp) return { ...session, businessId: imp.businessId }
  }

  return session
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 horas
    path: '/',
  })
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME)
}