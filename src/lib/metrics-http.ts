import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { logError } from '@/lib/safe-log'
import type { SessionPayload } from '@/lib/auth'

/** Mismo guard que /api/reports (ADMIN_ONLY en el middleware) repetido en el handler: defensa en profundidad. */
export async function requireMetricsAccess(): Promise<SessionPayload> {
  const { session } = await getAuthenticatedTenant()
  if (session.role !== 'admin' && session.role !== 'super_admin') throw new TenantError('FORBIDDEN')
  return session
}

/** Query string → objeto plano (un valor por clave). */
export function queryObject(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries())
}

export function metricsError(e: unknown, label: string): NextResponse {
  if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
  if (e instanceof ZodError) return NextResponse.json({ error: 'Parámetros inválidos', details: e.issues }, { status: 400 })
  logError(`metrics ${label} error`, e)
  return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
}
