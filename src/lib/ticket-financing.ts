import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { readFinancingConfig, toPublicFinancing } from '@/lib/financing'

/**
 * Financiamiento (Cashea) DECLARADO en el ticket — venta u pedido. Fuente única para POS, pedidos y checkout público.
 * Cashea es de un tercero, todo o nada, y se cobra al precio BCV completo (nunca Divisa).
 * Contrato: .doc/CONTRATO_CASHEA_TICKET.md. La config del negocio (activo, proveedor, frase) vive en lib/financing.ts.
 */

export const FINANCING_STATUSES = ['requested', 'approved', 'rejected'] as const
export type FinancingStatus = (typeof FINANCING_STATUSES)[number]

export const FINANCING_ACTIONS = ['request', 'approve', 'reject', 'reopen', 'clear'] as const
export type FinancingAction = (typeof FINANCING_ACTIONS)[number]
export const financingActionSchema = z.object({ action: z.enum(FINANCING_ACTIONS) }).strict()

export const PAYMENT_KINDS = ['cashea', 'bs', 'divisa'] as const
export type PaymentKind = (typeof PAYMENT_KINDS)[number]

export const STATUS_LABELS: Record<FinancingStatus, string> = {
  requested: 'Solicitado',
  approved:  'Aprobado',
  rejected:  'Rechazado',
}

export class FinancingError extends Error {
  constructor(readonly status: number, message: string, readonly blockedProducts?: { id: number; name: string }[]) {
    super(message)
  }
}

export interface TicketFinancing {
  status:       FinancingStatus
  status_label: string
  provider:     string | null
  phrase:       string | null
}

export interface FinancingTicket {
  kind:       'sale' | 'order'
  id:         number
  number:     string
  status:     string
  price_mode: string
  total_usd:  number
  total_bs:   number
  financing:  TicketFinancing | null
}

interface FinancingColumns {
  financing_status:   string | null
  financing_provider: string | null
  financing_phrase:   string | null
}

const isStatus = (v: string | null): v is FinancingStatus => v !== null && (FINANCING_STATUSES as readonly string[]).includes(v)

/** Pide o ya tiene financiamiento vivo (bloquea Divisa). 'rejected' libera. */
export const isFinancingActive = (status: string | null | undefined): boolean => status === 'requested' || status === 'approved'

export function toTicketFinancing(c: FinancingColumns): TicketFinancing | null {
  if (!isStatus(c.financing_status)) return null
  return { status: c.financing_status, status_label: STATUS_LABELS[c.financing_status], provider: c.financing_provider, phrase: c.financing_phrase }
}

const CHARGED_SALE = 'Esta venta ya fue cobrada; no se puede cambiar el financiamiento.'
const CHARGED_ORDER = 'Este pedido ya fue cobrado; no se puede cambiar el financiamiento.'
export const DIVISA_BLOCKS_FINANCING_MESSAGE =
  'El financiamiento se cobra al precio BCV completo. Cambia el ticket a BCV antes de pedirlo.'
export const FINANCING_BLOCKS_DIVISA_MESSAGE =
  'Este ticket pide financiamiento, que se cobra al precio BCV completo. Retira el financiamiento para cobrar en Divisa.'

/**
 * Elegibilidad: financiamiento ACTIVO en el negocio y NINGÚN producto excluido. Devuelve el snapshot (proveedor y frase)
 * o lanza FinancingError 409 en español (con los productos que lo impiden).
 */
export async function assertFinancingEligible(
  db: Pick<Prisma.TransactionClient, 'business' | 'product'>,
  businessId: number,
  productIds: number[],
): Promise<{ provider: string; phrase: string }> {
  const business = await db.business.findUnique({ where: { id: businessId }, select: { settings: true } })
  const pub = toPublicFinancing(readFinancingConfig(business?.settings ?? null, businessId))
  if (!pub) throw new FinancingError(409, 'Este negocio no tiene el financiamiento activo.')

  const blocked = await db.product.findMany({
    where:  { id: { in: productIds }, business_id: businessId, financing_excluded: true },
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  })
  if (blocked.length > 0) {
    const names = blocked.map(p => `"${p.name}"`).join(', ')
    throw new FinancingError(
      409,
      blocked.length === 1
        ? `${names} no está disponible con financiamiento. Quítalo del ticket o elige otro método de pago.`
        : `${names} no están disponibles con financiamiento. Quítalos del ticket o elige otro método de pago.`,
      blocked,
    )
  }
  return { provider: pub.name ?? 'Financiamiento propio', phrase: pub.phrase.slice(0, 80) }
}

/** Transiciones permitidas (regla 3 del contrato). Devuelve el estado nuevo, 'same' si no cambia o 'invalid'. */
function nextStatus(from: FinancingStatus | null, action: FinancingAction): FinancingStatus | null | 'same' | 'invalid' {
  switch (action) {
    case 'request': return from === null ? 'requested' : from === 'requested' ? 'same' : 'invalid'
    case 'approve': return from === 'requested' ? 'approved' : from === 'approved' ? 'same' : 'invalid'
    case 'reject':  return from === 'requested' || from === 'approved' ? 'rejected' : from === 'rejected' ? 'same' : 'invalid'
    case 'reopen':  return from === 'rejected' ? 'requested' : from === 'requested' ? 'same' : 'invalid'
    case 'clear':   return from === null ? 'same' : null
  }
}

const TRANSITION_MESSAGE: Record<FinancingAction, string> = {
  request: 'Este ticket ya tiene un estado de financiamiento: usa "volver a solicitar" si fue rechazado.',
  approve: 'Solo se puede aprobar un financiamiento solicitado.',
  reject:  'Solo se puede rechazar un financiamiento solicitado o aprobado.',
  reopen:  'Solo se puede volver a solicitar un financiamiento rechazado.',
  clear:   'No hay financiamiento que retirar.',
}

interface LoadedTicket extends FinancingColumns {
  kind:       'sale' | 'order'
  id:         number
  number:     string
  status:     string
  price_mode: string
  total_usd:  number
  total_bs:   number
  productIds: number[]
}

export interface FinancingActor { businessId: number; userId: number; role: string }

async function loadSale(tx: Prisma.TransactionClient, actor: FinancingActor, id: number): Promise<LoadedTicket> {
  await tx.$queryRaw`SELECT id FROM sales WHERE id = ${id} AND business_id = ${actor.businessId} FOR UPDATE`
  const s = await tx.sale.findFirst({ where: { id, business_id: actor.businessId }, include: { items: { select: { product_id: true } } } })
  // Un cajero solo opera SUS tickets (igual que price-mode); el admin puede con cualquiera.
  if (!s || (actor.role === 'cashier' && s.cashier_id !== actor.userId)) throw new FinancingError(404, 'Venta no encontrada')
  if (s.status === 'paid') throw new FinancingError(409, CHARGED_SALE)
  if (s.status !== 'draft' && s.status !== 'pending') throw new FinancingError(409, `Esta venta está en estado "${s.status}"; no se puede cambiar el financiamiento.`)
  return {
    kind: 'sale', id: s.id, number: s.ticket_number, status: s.status, price_mode: s.price_mode,
    total_usd: Number(s.total_usd), total_bs: Number(s.total_bs), productIds: s.items.map(i => i.product_id),
    financing_status: s.financing_status, financing_provider: s.financing_provider, financing_phrase: s.financing_phrase,
  }
}

async function loadOrder(tx: Prisma.TransactionClient, actor: FinancingActor, id: number): Promise<LoadedTicket> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id} AND business_id = ${actor.businessId} FOR UPDATE`
  const o = await tx.order.findFirst({ where: { id, business_id: actor.businessId }, include: { items: { select: { product_id: true } } } })
  if (!o) throw new FinancingError(404, 'Pedido no encontrado')
  if (o.sale_id !== null) throw new FinancingError(409, CHARGED_ORDER)
  if (o.status === 'cancelled') throw new FinancingError(409, 'Este pedido está cancelado; no se puede cambiar el financiamiento.')
  if (o.status === 'delivered') throw new FinancingError(409, 'Este pedido ya fue entregado; no se puede cambiar el financiamiento.')
  return {
    kind: 'order', id: o.id, number: o.order_number, status: o.status, price_mode: o.price_mode,
    total_usd: Number(o.total_usd), total_bs: Number(o.total_bs), productIds: o.items.map(i => i.product_id),
    financing_status: o.financing_status, financing_provider: o.financing_provider, financing_phrase: o.financing_phrase,
  }
}

const ticketOf = (t: LoadedTicket, c: FinancingColumns): FinancingTicket => ({
  kind: t.kind, id: t.id, number: t.number, status: t.status, price_mode: t.price_mode,
  total_usd: t.total_usd, total_bs: t.total_bs, financing: toTicketFinancing(c),
})

/**
 * Aplica una acción de financiamiento a una venta abierta o a un pedido sin cobrar, dentro de la transacción del
 * llamador y con la fila bloqueada (FOR UPDATE, con business_id). Escribe la bitácora (quién, de qué estado a cuál).
 */
export async function applyFinancingActionTx(
  tx: Prisma.TransactionClient,
  actor: FinancingActor,
  kind: 'sale' | 'order',
  id: number,
  action: FinancingAction,
): Promise<FinancingTicket> {
  const t = kind === 'sale' ? await loadSale(tx, actor, id) : await loadOrder(tx, actor, id)
  const from = isStatus(t.financing_status) ? t.financing_status : null
  const next = nextStatus(from, action)
  if (next === 'invalid') throw new FinancingError(409, TRANSITION_MESSAGE[action])
  if (next === 'same') return ticketOf(t, t)

  let provider = t.financing_provider
  let phrase = t.financing_phrase
  if (next !== null) {
    // Pedir, volver a pedir o aprobar exige que el ticket siga siendo elegible y en BCV.
    if (t.price_mode === 'divisa') throw new FinancingError(409, DIVISA_BLOCKS_FINANCING_MESSAGE)
    const snapshot = await assertFinancingEligible(tx, actor.businessId, t.productIds)
    if (action === 'request' || action === 'reopen') { provider = snapshot.provider; phrase = snapshot.phrase }
  } else {
    provider = null
    phrase = null
  }

  const data = { financing_status: next, financing_provider: provider, financing_phrase: phrase }
  if (kind === 'sale') await tx.sale.update({ where: { id }, data })
  else await tx.order.update({ where: { id }, data })

  await tx.activityLog.create({
    data: {
      business_id: actor.businessId,
      user_id:     actor.userId,
      action:      next === null ? 'financing_cleared' : from === null ? 'financing_requested' : 'financing_status_changed',
      model_type:  kind === 'sale' ? 'Sale' : 'Order',
      model_id:    id,
      old_values:  { financing_status: from },
      new_values:  { financing_status: next },
    },
  })
  return ticketOf(t, data)
}

/**
 * Cambio de ítems en un ticket que ya tiene financiamiento vivo (requested/approved): la elegibilidad se REVALIDA con
 * los productos nuevos (409 si queda uno excluido o el financiamiento se apagó) y un 'approved' vuelve a 'requested',
 * porque el total cambió y nadie aprobó ese monto. Con la fila del ticket ya bloqueada por el llamador. Sin
 * financiamiento vivo no hace nada.
 */
export async function reconcileFinancingAfterItemsChangeTx(
  tx: Prisma.TransactionClient,
  actor: { businessId: number; userId: number },
  kind: 'sale' | 'order',
  id: number,
  current: { financing_status: string | null; price_mode: string },
  newProductIds: number[],
  reason = 'Cambiaron los ítems: el monto debe aprobarse de nuevo',
): Promise<void> {
  if (!isFinancingActive(current.financing_status)) return
  if (current.price_mode === 'divisa') throw new FinancingError(409, FINANCING_BLOCKS_DIVISA_MESSAGE)
  try {
    await assertFinancingEligible(tx, actor.businessId, newProductIds)
  } catch (err) {
    if (err instanceof FinancingError) {
      throw new FinancingError(409, `${err.message} Retira el financiamiento del ticket antes de hacer este cambio.`, err.blockedProducts)
    }
    throw err
  }
  if (current.financing_status !== 'approved') return
  if (kind === 'sale') await tx.sale.update({ where: { id }, data: { financing_status: 'requested' } })
  else await tx.order.update({ where: { id }, data: { financing_status: 'requested' } })
  await tx.activityLog.create({
    data: {
      business_id: actor.businessId, user_id: actor.userId, action: 'financing_status_changed',
      model_type: kind === 'sale' ? 'Sale' : 'Order', model_id: id,
      reason,
      old_values: { financing_status: 'approved' }, new_values: { financing_status: 'requested' },
    },
  })
}

/**
 * Regla 4 del contrato: con qué métodos de pago se puede cobrar un ticket según su estado de financiamiento.
 * `financingStatus` es el estado YA bloqueado dentro de la transacción de cobro. Con 'approved' se revalida además,
 * por defensa en profundidad, que el ticket siga en BCV y que sus productos sigan siendo elegibles.
 */
export async function assertPaymentMatchesFinancing(
  db: Pick<Prisma.TransactionClient, 'paymentMethod' | 'business' | 'product'>,
  businessId: number,
  financingStatus: string | null,
  paymentMethodIds: number[],
  ticket?: { priceMode: string; productIds: number[] },
): Promise<void> {
  const methods = await db.paymentMethod.findMany({
    where:  { id: { in: paymentMethodIds }, business_id: businessId },
    select: { is_financing: true },
  })
  // Todos los ids pedidos (sin repetir) deben ser métodos de ESTE negocio: si falta alguno no se adivina qué se cobra.
  if (methods.length !== new Set(paymentMethodIds).size) throw new FinancingError(409, 'Alguno de los métodos de pago no es válido para este negocio.')
  const anyFinancing = methods.some(m => m.is_financing)
  const allFinancing = methods.length > 0 && methods.every(m => m.is_financing)

  switch (financingStatus) {
    case 'approved':
      if (!allFinancing) throw new FinancingError(409, 'El financiamiento aprobado se cobra completo con el método financiador (todo o nada): no se mezcla con otros métodos.')
      if (ticket) {
        if (ticket.priceMode !== 'bcv') throw new FinancingError(409, FINANCING_BLOCKS_DIVISA_MESSAGE)
        await assertFinancingEligible(db, businessId, ticket.productIds)
      }
      return
    case 'requested':
      throw new FinancingError(409, anyFinancing
        ? 'El financiamiento todavía no está aprobado. Espera la aprobación para cobrar.'
        : 'Este ticket pide financiamiento: apruébalo, recházalo o retíralo antes de cobrar.')
    default: // null (no usa) o 'rejected'
      if (anyFinancing) throw new FinancingError(409, financingStatus === 'rejected'
        ? 'El financiamiento fue rechazado: cobra con otro método de pago.'
        : 'Para cobrar con el método financiador, declara el financiamiento en el ticket y espera su aprobación.')
  }
}
