import type { Prisma } from '@prisma/client'
import { lenientCheckoutCedula, normalizeClientPhone, phoneLookupVariants } from '@/lib/customer-identity'

type Db = Pick<Prisma.TransactionClient, 'client'>
export interface ClientKeys { cedula?: string | null; phone?: string | null }

const keysWhere = (k: ClientKeys): Prisma.ClientWhereInput[] => {
  const cedula = lenientCheckoutCedula(k.cedula).value
  const variants = phoneLookupVariants(k.phone)
  return [...(cedula ? [{ cedula }] : []), ...(variants.length > 0 ? [{ phone: { in: variants } }] : [])]
}

/**
 * Enlace automático pedido→cliente: el id SOLO si exactamente UN cliente activo del negocio coincide por cédula o teléfono
 * normalizado. Ninguno, varios (o cédula y teléfono apuntando a clientes distintos) → null: no se adivina.
 */
export async function findUniqueClientId(db: Db, businessId: number, keys: ClientKeys): Promise<number | null> {
  const OR = keysWhere(keys)
  if (OR.length === 0) return null
  const rows = await db.client.findMany({ where: { business_id: businessId, is_active: true, OR }, select: { id: true }, take: 2 })
  return rows.length === 1 ? rows[0].id : null
}

/** Cliente existente por cédula (identidad) y si no por teléfono; el verificado/más antiguo primero. Incluye inactivos: no se duplica. */
export async function findExistingClientId(db: Db, businessId: number, keys: ClientKeys): Promise<number | null> {
  const cedula = lenientCheckoutCedula(keys.cedula).value
  const order: Prisma.ClientOrderByWithRelationInput[] = [{ verified: 'desc' }, { id: 'asc' }]
  if (cedula) {
    const byCedula = await db.client.findFirst({ where: { business_id: businessId, cedula }, orderBy: order, select: { id: true } })
    if (byCedula) return byCedula.id
  }
  const variants = phoneLookupVariants(keys.phone)
  if (variants.length === 0) return null
  return (await db.client.findFirst({ where: { business_id: businessId, phone: { in: variants } }, orderBy: order, select: { id: true } }))?.id ?? null
}

export const phoneForClient = (raw: string | null | undefined): string | null => normalizeClientPhone(raw) || null
