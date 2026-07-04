import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// Secreto propio (no se importa de auth.ts para evitar ciclo: auth.ts → impersonation.ts).
const rawSecret = process.env.JWT_SECRET
if (!rawSecret) {
  throw new Error('[ActivoPOS] JWT_SECRET env variable is required — set it in .env.local for dev')
}
const SECRET = new TextEncoder().encode(rawSecret)

const COOKIE_NAME = 'impersonation'
const EXPIRES_IN = '2h'
// Distingue este token de un session token firmado con el mismo secreto.
const TYP = 'impersonation'

export interface ImpersonationPayload {
  businessId:   number
  businessName: string
}

export async function signImpersonation(payload: ImpersonationPayload): Promise<string> {
  return new SignJWT({ ...payload, typ: TYP })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(SECRET)
}

/** Verifica la cookie firmada. Devuelve null si falta, está expirada, manipulada o no es de tipo impersonation. */
export async function readImpersonation(): Promise<ImpersonationPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] })
    if (payload.typ !== TYP) return null
    if (typeof payload.businessId !== 'number' || typeof payload.businessName !== 'string') return null
    return { businessId: payload.businessId, businessName: payload.businessName }
  } catch {
    return null
  }
}

export function setImpersonationCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 2, // 2 horas
    path: '/',
  })
}

export function clearImpersonationCookie() {
  cookies().delete(COOKIE_NAME)
}

/** true si hay una cookie de impersonación firmada y vigente. Server-only. */
export async function isImpersonating(): Promise<boolean> {
  return (await readImpersonation()) !== null
}
