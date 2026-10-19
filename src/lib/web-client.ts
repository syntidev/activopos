import type { Prisma } from '@prisma/client'
import { normalizeClientPhone, phoneLookupVariants, sameName } from '@/lib/customer-identity'

/**
 * Cliente del checkout público: se identifica por CÉDULA normalizada dentro del negocio; el
 * teléfono solo sirve de respaldo para adoptar un cliente viejo SIN cédula. Solo servidor.
 *
 * Reglas que el llamador y esta función garantizan:
 *  - El Client conserva SU nombre y SU dirección: un pedido público nunca los sobrescribe
 *    (cualquiera que conozca una cédula podría envenenar el registro).
 *  - Cédula ya registrada con otro nombre → nameMismatch = true (el pedido sale con alerta); nunca
 *    se devuelve ese nombre al público.
 *  - Sin @@unique (hay cédulas duplicadas en producción) la carrera se evita bloqueando la fila del
 *    negocio (SELECT ... FOR UPDATE, se libera al COMMIT) antes de crear y releyendo con lectura
 *    bloqueante, que ve lo ya confirmado aunque el snapshot de la transacción sea anterior.
 *    ponytail: serializa la CREACIÓN de clientes por negocio; si el volumen lo exige, columna
 *    única generada o tabla de llaves.
 */

type Tx = Prisma.TransactionClient

interface ClientRow {
  id: number
  name: string
  address: string | null
}

export interface ResolvedWebClient extends ClientRow {
  created: boolean
  nameMismatch: boolean
}

export interface ResolveWebClientInput {
  businessId: number
  /** Cédula YA normalizada (V-12345678). */
  cedula: string
  phone: string
  name: string
  /** Dirección que se guarda SOLO si el cliente se crea ahora. */
  newAddress: string | null
  /** false cuando el pedido pide "misma dirección": si no hay cliente, no se crea nada. */
  canCreate: boolean
}

const EMPTY_CEDULA = [{ cedula: null }, { cedula: '' }]

export async function resolveWebClient(tx: Tx, input: ResolveWebClientInput): Promise<ResolvedWebClient | null> {
  const { businessId, cedula } = input

  // Con duplicados históricos: primero el verificado, luego el más antiguo.
  let found: ClientRow | null = await tx.client.findFirst({
    where:   { business_id: businessId, cedula },
    orderBy: [{ verified: 'desc' }, { id: 'asc' }],
    select:  { id: true, name: true, address: true },
  })

  if (!found && input.canCreate) {
    await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${businessId} FOR UPDATE`
    const locked = await tx.$queryRaw<ClientRow[]>`
      SELECT id, name, address FROM clients
       WHERE business_id = ${businessId} AND cedula = ${cedula}
       ORDER BY id ASC LIMIT 1 FOR UPDATE`
    found = locked[0] ?? null
  }

  if (found) {
    return { ...found, created: false, nameMismatch: !sameName(input.name, found.name) }
  }
  if (!input.canCreate) return null

  // Respaldo por teléfono: solo un cliente viejo SIN cédula y con el MISMO nombre (dos personas
  // pueden compartir teléfono: con otro nombre se crea un cliente nuevo).
  const variants = phoneLookupVariants(input.phone)
  if (variants.length > 0) {
    const legacy = await tx.client.findFirst({
      where:   { business_id: businessId, phone: { in: variants }, OR: EMPTY_CEDULA },
      orderBy: { id: 'asc' },
      select:  { id: true, name: true, address: true },
    })
    if (legacy && sameName(input.name, legacy.name)) {
      const adopted = await tx.client.updateMany({
        where: { id: legacy.id, business_id: businessId, OR: EMPTY_CEDULA },
        data:  { cedula },
      })
      if (adopted.count === 1) return { ...legacy, created: false, nameMismatch: false }
    }
  }

  const created = await tx.client.create({
    data: {
      business_id: businessId,
      name:        input.name,
      phone:       normalizeClientPhone(input.phone) || input.phone,
      cedula,
      origin:      'web',
      verified:    false,
      address:     input.newAddress,
    },
    select: { id: true, name: true, address: true },
  })
  return { ...created, created: true, nameMismatch: false }
}
