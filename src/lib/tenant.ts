import { getSession, type SessionPayload } from './auth'
import { getTenantPrisma, type TenantPrisma } from './prisma-tenant'

/**
 * Sesión autenticada + PrismaClient con scope de tenant ya aplicado.
 *
 * Reemplaza el patrón repetido en cada endpoint:
 *   const session = await getSession()
 *   if (!session) return 401
 *   ...luego filtrar a mano por session.businessId en CADA query
 *
 * Uso:
 *   try {
 *     const { session, db } = await getAuthenticatedTenant()
 *     const products = await db.product.findMany() // business_id ya inyectado
 *   } catch (e) {
 *     if (e instanceof TenantError) return NextResponse.json(...)
 *     throw e
 *   }
 */
export async function getAuthenticatedTenant(): Promise<{
  session: SessionPayload
  db: TenantPrisma
}> {
  const session = await getSession()
  if (!session) {
    throw new TenantError('NOT_AUTHENTICATED')
  }
  return {
    session,
    db: getTenantPrisma(session.businessId),
  }
}

export type TenantErrorCode = 'NOT_AUTHENTICATED' | 'FORBIDDEN'

export class TenantError extends Error {
  readonly code: TenantErrorCode
  /** HTTP status sugerido para la respuesta. */
  readonly status: number

  constructor(code: TenantErrorCode) {
    super(code === 'NOT_AUTHENTICATED' ? 'No autenticado' : 'Sin permiso')
    this.name = 'TenantError'
    this.code = code
    this.status = code === 'NOT_AUTHENTICATED' ? 401 : 403
  }
}
