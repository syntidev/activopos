import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
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
 *  - Sin @@unique (hay cédulas duplicadas en producción) la carrera se evita serializando los pedidos
 *    del MISMO cliente con lockWebCheckout (fila propia en web_order_locks, no la del negocio): quien
 *    llega segundo espera al commit del primero y entonces SÍ ve su cliente y sus pedidos.
 *    ponytail: la tabla crece una fila por cédula/teléfono; si molesta, purga por touched_at.
 */

type Tx = Prisma.TransactionClient

interface ClientRow {
  id: number
  name: string
  address: string | null
  phone: string | null
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
const CLIENT_SELECT = { id: true, name: true, address: true, phone: true } as const

/** Llaves de serialización de un pedido web: una por cédula y otra por teléfono (el tope cuenta por ambas). */
export function webCheckoutKeys(cedula: string, phone: string): string[] {
  return [`ced:${cedula}`, `tel:${normalizeClientPhone(phone)}`]
}

/**
 * Asegura que existan las filas de llave. Va FUERA de la transacción y como sentencias sueltas: si la
 * primera inserción ocurriera dentro, varias simultáneas sobre la misma llave nueva se bloquearían entre
 * sí al ampliar el lock y darían deadlock.
 */
export async function ensureWebCheckoutLocks(businessId: number, keys: string[]): Promise<void> {
  // Lectura simple (no bloquea): un INSERT IGNORE sobre una fila que otro pedido tiene bloqueada se
  // quedaría esperando fuera de los tiempos de la transacción. Solo se inserta lo que de verdad falta.
  const rows = await prisma.$queryRaw<{ lock_key: string }[]>`
    SELECT lock_key FROM web_order_locks WHERE business_id = ${businessId} AND lock_key IN (${Prisma.join(keys)})`
  const have = new Set(rows.map(r => r.lock_key))
  for (const key of keys) {
    if (!have.has(key)) {
      await prisma.$executeRaw`INSERT IGNORE INTO web_order_locks (business_id, lock_key) VALUES (${businessId}, ${key})`
    }
  }
}

/** El lock del cliente no se obtuvo a tiempo: otro pedido suyo sigue en curso. El llamador responde 503. */
export class WebCheckoutBusyError extends Error {
  constructor() { super('web checkout busy') }
}

// Espera máxima por el lock del cliente (< maxWait/timeout de la transacción). innodb_lock_wait_timeout
// existe en MySQL y en MariaDB; `FOR UPDATE WAIT n` solo en MariaDB.
const LOCK_WAIT_SECONDS = 5
const isLockWaitTimeout = (err: unknown): boolean => err instanceof Error && /\b1205\b|lock wait timeout/i.test(err.message)

/**
 * Bloquea las filas de llave hasta el COMMIT/ROLLBACK de la transacción. Va PRIMERO dentro de la
 * transacción: así la primera lectura consistente (el conteo de pedidos abiertos) ya ve lo que
 * confirmó quien tenía el lock. Un solo SELECT ordenado por llave: todos los pedidos toman las
 * filas en el mismo orden (sin deadlock entre ellos). Solo espera quien comparte cédula o teléfono.
 */
export async function lockWebCheckout(tx: Tx, businessId: number, keys: string[]): Promise<void> {
  // La espera se acota SOLO mientras se pide el lock: la variable es de la conexión y se devuelve al
  // valor por defecto enseguida (la conexión vuelve al pool y la usan las ventas del POS).
  await tx.$executeRaw`SET SESSION innodb_lock_wait_timeout = ${Prisma.raw(String(LOCK_WAIT_SECONDS))}`
  try {
    const rows = await tx.$queryRaw<{ lock_key: string }[]>`
      SELECT lock_key FROM web_order_locks
       WHERE business_id = ${businessId} AND lock_key IN (${Prisma.join(keys)})
       ORDER BY lock_key FOR UPDATE`
    if (rows.length !== keys.length) throw new Error('web_order_locks: faltan filas de llave')
  } catch (err) {
    if (isLockWaitTimeout(err)) throw new WebCheckoutBusyError()
    throw err
  } finally {
    await tx.$executeRaw`SET SESSION innodb_lock_wait_timeout = DEFAULT`.catch(() => undefined)
  }
}

export async function resolveWebClient(tx: Tx, input: ResolveWebClientInput): Promise<ResolvedWebClient | null> {
  const { businessId, cedula } = input

  // Con duplicados históricos: primero el verificado, luego el más antiguo.
  const found: ClientRow | null = await tx.client.findFirst({
    where:   { business_id: businessId, cedula },
    orderBy: [{ verified: 'desc' }, { id: 'asc' }],
    select:  CLIENT_SELECT,
  })

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
      select:  CLIENT_SELECT,
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
    select: CLIENT_SELECT,
  })
  return { ...created, created: true, nameMismatch: false }
}
