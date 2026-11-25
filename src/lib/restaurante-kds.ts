import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import type { SessionPayload } from '@/lib/auth'
import type { TenantPrisma } from '@/lib/prisma-tenant'
import { getAuthenticatedTenant } from '@/lib/tenant'
import { lockOpenOrder, type Tx } from '@/lib/restaurante-cuenta'
import { AccountError, OPEN_ACCOUNT_STATUSES, isRestauranteEnabled } from '@/lib/restaurante-server'
import { stationIdsOfUser } from '@/lib/user-stations'
import type { ItemKdsStatus, ItemModifierDTO, KdsBoardDTO, KdsItemDTO, KdsTicketDTO, RoutingDTO, StationDTO } from '@/types/restaurante'

/**
 * Estaciones, ruteo y KDS por estación (R3). Sin precios en nada de lo que sale de aquí.
 * Ruteo: producto → categoría → estación por defecto; el resultado se CONGELA en OrderItem.station_id al enviar.
 */

/* ── Acceso ── */

export interface KdsAccess {
  session: SessionPayload
  db: TenantPrisma
  /** Estaciones que esta persona puede ver: las asignadas al cocinero, o 'all' para el administrador. */
  stationIds: number[] | 'all'
}

/** Puerta del KDS: flag del negocio (404) y rol cocinero (sus estaciones) o administrador (todas). Nadie más (403). */
export async function requireKdsAccess(): Promise<KdsAccess | NextResponse> {
  const { session, db } = await getAuthenticatedTenant()
  if (!(await isRestauranteEnabled(session.businessId))) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (session.role === 'admin' || session.role === 'super_admin') return { session, db, stationIds: 'all' }
  if (session.role === 'kitchen') return { session, db, stationIds: await stationIdsOfUser(db, session.businessId, session.userId) }
  return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
}

function assertStation(access: KdsAccess, stationId: number): void {
  if (access.stationIds !== 'all' && !access.stationIds.includes(stationId)) throw new AccountError(403, 'Esa estación no está asignada a tu usuario')
}

/* ── Esquemas (Zod 4) ── */

const minutes = z.number().int().min(1).max(240)
export const stationCreateSchema = z.object({
  name:         z.string().trim().min(1).max(60),
  color:        z.string().trim().max(20).nullish(),
  warn_min:     minutes.optional(),
  critical_min: minutes.optional(),
  is_default:   z.boolean().optional(),
  sort_order:   z.number().int().min(0).max(999).optional(),
})
export const stationPatchSchema = stationCreateSchema.partial()
  .extend({ active: z.boolean().optional(), user_ids: z.array(z.number().int().positive()).max(50).optional() })
  .refine(o => Object.keys(o).length > 0, { message: 'Nada que actualizar' })

/** El umbral rojo tiene que ser mayor que el ámbar. */
export function assertThresholds(warn: number, critical: number): void {
  if (critical <= warn) throw new AccountError(422, 'El umbral rojo debe ser mayor que el ámbar')
}

export const sendSchema = z.object({ course: z.number().int().min(1).max(3).optional() })
export const kdsActionSchema = z.object({ action: z.enum(['iniciar', 'listo', 'deshacer', 'visto']), scope: z.enum(['item', 'comanda']).optional() })
export const fireSchema = z.object({ order_id: z.number().int().positive(), course: z.number().int().min(2).max(3) })
export const routingSchema = z.union([
  z.object({ category_id: z.number().int().positive(), station_id: z.number().int().positive().nullable(), requires_preparation: z.boolean().optional() }),
  z.object({ product_id: z.number().int().positive(), station_id: z.number().int().positive().nullable() }),
])

/* ── Estaciones ── */

export function toStation(s: Prisma.PrepStationGetPayload<object>, extra: { users?: StationDTO['users']; open_tickets?: number } = {}): StationDTO {
  return { id: s.id, name: s.name, color: s.color, warn_min: s.warn_min, critical_min: s.critical_min, is_default: s.is_default, sort_order: s.sort_order, active: s.active, ...extra }
}

/** Deja UNA sola estación por defecto activa por negocio (MySQL no tiene índice único parcial: se valida aquí). */
export async function makeDefault(db: TenantPrisma, stationId: number): Promise<void> {
  await db.$transaction([
    db.prepStation.updateMany({ where: { is_default: true, id: { not: stationId } }, data: { is_default: false } }), // business_id inyectado
    db.prepStation.update({ where: { id: stationId }, data: { is_default: true } }),
  ])
}

/* ── Ruteo ── */

export interface RoutingInput { productStationId: number | null; categoryStationId: number | null; requiresPreparation: boolean }

/**
 * Estación de un ítem al enviarlo: la del producto, si no la de su categoría, si no la por defecto (solo si la categoría exige preparación).
 * null = no pasa por cocina (nace listo). Una estación inactiva cae a la por defecto. Sin estación por defecto → 422.
 */
export async function resolveStationId(tx: Tx, businessId: number, r: RoutingInput): Promise<number | null> {
  const explicit = r.productStationId ?? r.categoryStationId
  if (explicit !== null) {
    const st = await tx.prepStation.findFirst({ where: { id: explicit, business_id: businessId, active: true }, select: { id: true } })
    if (st) return st.id
  } else if (!r.requiresPreparation) {
    return null
  }
  const def = await tx.prepStation.findFirst({ where: { business_id: businessId, is_default: true, active: true }, select: { id: true } })
  if (!def) throw new AccountError(422, 'Configura una estación por defecto en Configuración › Restaurante › Estaciones y ruteo')
  return def.id
}

export async function loadRouting(db: TenantPrisma): Promise<RoutingDTO> {
  const [categories, overrides, def] = await Promise.all([
    db.category.findMany({ where: { active: true }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }], select: { id: true, name: true, station_id: true, requires_preparation: true } }),
    db.product.findMany({ where: { active: true, station_id: { not: null } }, orderBy: { name: 'asc' }, take: 200, select: { id: true, name: true, station_id: true, category: { select: { name: true } } } }),
    db.prepStation.findFirst({ where: { is_default: true, active: true }, select: { id: true } }),
  ])
  return {
    categories,
    overrides: overrides.flatMap(p => (p.station_id === null ? [] : [{ id: p.id, name: p.name, station_id: p.station_id, category_name: p.category?.name ?? null }])),
    default_station_id: def?.id ?? null,
  }
}

/** Fija la estación de una categoría o de un producto (null = hereda). La estación tiene que ser del negocio. No mueve ítems ya enviados. */
export async function setRouting(db: TenantPrisma, input: z.infer<typeof routingSchema>): Promise<void> {
  if (input.station_id !== null) {
    const st = await db.prepStation.findFirst({ where: { id: input.station_id, active: true }, select: { id: true } }) // business_id inyectado
    if (!st) throw new AccountError(404, 'Estación no encontrada')
  }
  if ('category_id' in input) {
    const cat = await db.category.findFirst({ where: { id: input.category_id }, select: { id: true } })
    if (!cat) throw new AccountError(404, 'Categoría no encontrada')
    await db.category.update({ where: { id: cat.id }, data: { station_id: input.station_id, ...(input.requires_preparation !== undefined ? { requires_preparation: input.requires_preparation } : {}) } })
  } else {
    const prod = await db.product.findFirst({ where: { id: input.product_id }, select: { id: true } })
    if (!prod) throw new AccountError(404, 'Producto no encontrado')
    await db.product.update({ where: { id: prod.id }, data: { station_id: input.station_id } })
  }
}

/* ── Enviar a estaciones ── */

/**
 * Pasa los borradores de la cuenta (todos, o solo los de un curso) a 'sent', congelando la estación de cada uno. Los ítems que no
 * pasan por cocina (categoría sin preparación y sin estación) nacen 'ready': el mesonero los sirve directo. Todo en una transacción.
 */
export async function sendItems(db: TenantPrisma, businessId: number, orderId: number, userId: number, course: number | null): Promise<{ sent: number; direct: number }> {
  return db.$transaction(async (tx: Tx) => {
    const order = await lockOpenOrder(tx, businessId, orderId)
    const drafts = await tx.orderItem.findMany({ where: { order_id: order.id, kds_status: 'draft', ...(course !== null ? { course } : {}) }, orderBy: { id: 'asc' } })
    if (drafts.length === 0) throw new AccountError(422, course !== null ? `No hay ítems del curso ${course} por enviar` : 'No hay ítems por enviar')

    const products = await tx.product.findMany({
      where:  { id: { in: Array.from(new Set(drafts.map(d => d.product_id))) }, business_id: businessId },
      select: { id: true, station_id: true, category: { select: { station_id: true, requires_preparation: true } } },
    })
    const byId = new Map(products.map(p => [p.id, p]))

    const now = new Date()
    let sent = 0
    let direct = 0
    for (const d of drafts) {
      const p = byId.get(d.product_id)
      const station = await resolveStationId(tx, businessId, {
        productStationId: p?.station_id ?? null, categoryStationId: p?.category?.station_id ?? null, requiresPreparation: p?.category?.requires_preparation ?? false,
      })
      if (station === null) {
        await tx.orderItem.update({ where: { id: d.id }, data: { kds_status: 'ready', sent_at: now, ready_at: now, kds_updated_at: now } })
        direct++
      } else {
        await tx.orderItem.update({ where: { id: d.id }, data: { kds_status: 'sent', station_id: station, sent_at: now, kds_updated_at: now } })
        sent++
      }
    }

    // Enviar algo después de pedir la cuenta la reabre (igual que agregar un ítem).
    if (order.account_status === 'bill_requested') await tx.order.update({ where: { id: order.id }, data: { account_status: 'open', bill_requested_at: null } })
    await tx.tableEvent.create({ data: { business_id: businessId, order_id: order.id, table_id: order.table_id, type: 'send', to_value: course !== null ? `curso ${course}` : 'todo', user_id: userId } })
    return { sent, direct }
  })
}

/* ── Cursos: "Espera curso 1" y Disparar ── */

interface HoldItem { id: number; course: number; kds_status: string | null }

/** Ítems 'sent' de curso 2+ que esperan: hay algo de un curso anterior todavía en cocina (sent o preparing) y ese curso no fue disparado. */
function heldIds(items: readonly HoldItem[], fired: ReadonlySet<number>): Set<number> {
  const pendingBefore = (c: number): boolean => items.some(i => i.course < c && (i.kds_status === 'sent' || i.kds_status === 'preparing'))
  return new Set(items.filter(i => i.kds_status === 'sent' && i.course > 1 && !fired.has(i.course) && pendingBefore(i.course)).map(i => i.id))
}

/** Libera un curso sin esperar al anterior. Queda en la bitácora de la mesa y avisa a las pantallas (kds_updated_at). */
export async function fireCourse(db: TenantPrisma, businessId: number, userId: number, orderId: number, course: number): Promise<void> {
  await db.$transaction(async (tx: Tx) => {
    const order = await lockOpenOrder(tx, businessId, orderId)
    const waiting = await tx.orderItem.count({ where: { order_id: order.id, course, kds_status: 'sent' } })
    if (waiting === 0) throw new AccountError(422, `No hay ítems del curso ${course} esperando en cocina`)
    await tx.tableEvent.create({ data: { business_id: businessId, order_id: order.id, table_id: order.table_id, type: 'fire', to_value: String(course), user_id: userId } })
    await tx.orderItem.updateMany({ where: { order_id: order.id, course, kds_status: 'sent' }, data: { kds_updated_at: new Date() } })
  })
}

/* ── Transiciones de cocina ── */

const UNDO_WINDOW_MS = 30_000

/**
 * Iniciar (sent→preparing), Listo (preparing→ready), Deshacer (el último paso, 30 s) y Visto (cocina confirma un ítem anulado).
 * scope 'comanda' aplica a todos los ítems de la estación en esa cuenta que estén en el estado de origen. Si nada cambia, 409
 * STALE: otra pantalla se adelantó y la actual solo se refresca (sin duplicar el cambio).
 */
export async function advanceItem(
  db: TenantPrisma, businessId: number, access: KdsAccess, itemId: number, action: 'iniciar' | 'listo' | 'deshacer' | 'visto', scope: 'item' | 'comanda',
): Promise<{ order_id: number; changed: number }> {
  const first = await db.orderItem.findFirst({ where: { id: itemId, order: { business_id: businessId, origin: 'table' } }, select: { id: true, order_id: true, station_id: true } })
  if (!first || first.station_id === null) throw new AccountError(404, 'Ítem no encontrado')
  assertStation(access, first.station_id)
  const stationId = first.station_id
  const userId = access.session.userId

  return db.$transaction(async (tx: Tx) => {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${first.order_id} AND business_id = ${businessId} FOR UPDATE`
    const peers = await tx.orderItem.findMany({ where: { order_id: first.order_id, station_id: stationId }, orderBy: { id: 'asc' } })
    const everyone = await tx.orderItem.findMany({ where: { order_id: first.order_id }, select: { id: true, course: true, kds_status: true } })
    const fireEvents = await tx.tableEvent.findMany({ where: { order_id: first.order_id, business_id: businessId, type: 'fire' }, select: { to_value: true } })
    const held = heldIds(everyone, new Set(fireEvents.map(e => Number(e.to_value)).filter(Number.isFinite)))

    const now = new Date()
    const target = scope === 'comanda' ? peers : peers.filter(p => p.id === itemId)
    let changed = 0
    for (const it of target) {
      const age = now.getTime() - (it.kds_updated_at?.getTime() ?? 0)
      if (action === 'iniciar' && it.kds_status === 'sent') {
        if (held.has(it.id)) {
          if (scope === 'item') throw new AccountError(422, 'Este ítem espera al curso anterior. Dispáralo si hay que prepararlo ya.')
          continue
        }
        await tx.orderItem.update({ where: { id: it.id }, data: { kds_status: 'preparing', started_at: now, started_by: userId, kds_updated_at: now } })
        changed++
      } else if (action === 'listo' && it.kds_status === 'preparing') {
        await tx.orderItem.update({ where: { id: it.id }, data: { kds_status: 'ready', ready_at: now, kds_updated_at: now } })
        changed++
      } else if (action === 'deshacer' && it.kds_status === 'preparing' && age <= UNDO_WINDOW_MS) {
        await tx.orderItem.update({ where: { id: it.id }, data: { kds_status: 'sent', started_at: null, started_by: null, kds_updated_at: now } })
        changed++
      } else if (action === 'deshacer' && it.kds_status === 'ready' && age <= UNDO_WINDOW_MS) {
        await tx.orderItem.update({ where: { id: it.id }, data: { kds_status: 'preparing', ready_at: null, kds_updated_at: now } })
        changed++
      } else if (action === 'visto' && it.kds_status === 'void' && it.sent_at !== null && it.served_at === null) {
        // Para un ítem anulado, served_at guarda cuándo cocina confirmó "Visto" (deja de salir en la pantalla).
        await tx.orderItem.update({ where: { id: it.id }, data: { served_at: now, kds_updated_at: now } })
        changed++
      }
    }
    if (changed === 0) throw new AccountError(409, 'El ítem ya cambió: se actualizó la pantalla', { code: 'STALE' })
    return { order_id: first.order_id, changed }
  })
}

/** El mesonero (o cajero/admin) marca un ítem listo como servido. */
export async function serveItem(db: TenantPrisma, businessId: number, orderId: number, itemId: number): Promise<void> {
  await db.$transaction(async (tx: Tx) => {
    const order = await lockOpenOrder(tx, businessId, orderId)
    const item = await tx.orderItem.findFirst({ where: { id: itemId, order_id: order.id } })
    if (!item) throw new AccountError(404, 'Ítem no encontrado')
    if (item.kds_status !== 'ready') throw new AccountError(409, 'El ítem todavía no está listo', { code: 'STALE' })
    const now = new Date()
    await tx.orderItem.update({ where: { id: item.id }, data: { kds_status: 'served', served_at: now, kds_updated_at: now } })
  })
}

/* ── Tablero ── */

const OVERLAP_MS = 2_000
const BOARD_LIMIT = 300

function parseMods(json: Prisma.JsonValue | null): ItemModifierDTO[] {
  if (!Array.isArray(json)) return []
  const out: ItemModifierDTO[] = []
  for (const m of json) {
    if (m && typeof m === 'object' && !Array.isArray(m)) {
      const r = m as Record<string, Prisma.JsonValue>
      out.push({ group: typeof r.group === 'string' ? r.group : '', option: typeof r.option === 'string' ? r.option : '', price_usd: 0 }) // el KDS nunca lleva precios
    }
  }
  return out
}

/**
 * Comandas de las estaciones que la persona puede ver. Sin since: el tablero completo. Con since (cursor de la respuesta anterior):
 * solo las cuentas que cambiaron, completas — el cliente reemplaza las suyas y quita las que ya no vienen (sondeo liviano).
 */
export async function loadBoard(db: TenantPrisma, businessId: number, access: KdsAccess, station: number | 'todas', since: Date | null): Promise<KdsBoardDTO> {
  const stationRows = await db.prepStation.findMany({
    where:   { active: true, ...(access.stationIds === 'all' ? {} : { id: { in: access.stationIds } }) },
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
  })
  const allowed = stationRows.map(s => s.id)
  if (station !== 'todas' && !allowed.includes(station)) throw new AccountError(403, 'Esa estación no está asignada a tu usuario')
  const targets = station === 'todas' ? allowed : [station]
  const serverTime = new Date(Date.now() - OVERLAP_MS).toISOString()

  const live: Prisma.OrderItemWhereInput = {
    station_id: { in: targets },
    order:      { business_id: businessId, origin: 'table', account_status: { in: [...OPEN_ACCOUNT_STATUSES] } },
    OR:         [{ kds_status: { in: ['sent', 'preparing', 'ready'] } }, { kds_status: 'void', sent_at: { not: null }, served_at: null }],
  }

  let changed: number[] | null = null
  if (since !== null && targets.length > 0) {
    const rows = await db.orderItem.findMany({
      where:    { station_id: { in: targets }, kds_updated_at: { gt: since }, order: { business_id: businessId, origin: 'table' } },
      select:   { order_id: true }, distinct: ['order_id'], take: 100,
    })
    changed = rows.map(r => r.order_id)
  }

  const items = targets.length === 0 || (changed !== null && changed.length === 0) ? [] : await db.orderItem.findMany({
    where:   { ...live, ...(changed !== null ? { order_id: { in: changed } } : {}) },
    include: { order: { select: { order_number: true, waiter: { select: { name: true } }, table: { select: { label: true, area: { select: { name: true } } } } } } },
    orderBy: [{ sent_at: 'asc' }, { id: 'asc' }], take: BOARD_LIMIT,
  })

  const orderIds = Array.from(new Set(items.map(i => i.order_id)))
  const [pending, fires] = orderIds.length === 0 ? [[], []] : await Promise.all([
    db.orderItem.findMany({ where: { order_id: { in: orderIds }, order: { business_id: businessId }, kds_status: { in: ['sent', 'preparing'] } }, select: { id: true, order_id: true, course: true, kds_status: true } }),
    db.tableEvent.findMany({ where: { order_id: { in: orderIds }, type: 'fire' }, select: { order_id: true, to_value: true } }),
  ])

  const tickets = new Map<string, KdsTicketDTO>()
  for (const it of items) {
    const key = `${it.order_id}:${it.station_id}`
    const fired = new Set(fires.filter(f => f.order_id === it.order_id).map(f => Number(f.to_value)))
    const held = heldIds(pending.filter(p => p.order_id === it.order_id), fired).has(it.id)
    const dto: KdsItemDTO = {
      id: it.id, quantity: Number(it.quantity), product_name: it.product_name, modifiers: parseMods(it.modifiers), note: it.note, course: it.course,
      status: (it.kds_status ?? 'sent') as ItemKdsStatus, held, void_reason: it.void_reason,
    }
    const sentAt = it.sent_at ? it.sent_at.toISOString() : serverTime
    const t = tickets.get(key)
    if (t) {
      t.items.push(dto)
      if (it.kds_status !== 'ready' && it.kds_status !== 'void' && sentAt < t.sent_at) t.sent_at = sentAt
    } else {
      tickets.set(key, {
        order_id: it.order_id, station_id: it.station_id ?? 0, order_number: it.order.order_number, table_label: it.order.table?.label ?? null,
        area_name: it.order.table?.area.name ?? null, waiter_name: it.order.waiter?.name ?? null, sent_at: sentAt, items: [dto],
      })
    }
  }
  const sorted = Array.from(tickets.values()).sort((a, b) => a.sent_at.localeCompare(b.sent_at))
  for (const t of sorted) t.items.sort((a, b) => a.course - b.course || a.id - b.id)

  // Comandas abiertas por estación (pestañas): una consulta liviana, siempre sobre todas las estaciones visibles.
  const open = allowed.length === 0 ? [] : await db.orderItem.findMany({
    where: { ...live, station_id: { in: allowed }, kds_status: { in: ['sent', 'preparing', 'ready'] } }, select: { station_id: true, order_id: true }, distinct: ['station_id', 'order_id'],
  })
  const counts = new Map<number, number>()
  for (const o of open) if (o.station_id !== null) counts.set(o.station_id, (counts.get(o.station_id) ?? 0) + 1)

  return {
    stations: stationRows.map(s => toStation(s, { open_tickets: counts.get(s.id) ?? 0 })),
    station, tickets: sorted, server_time: serverTime, changed,
  }
}
