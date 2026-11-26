import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { generateTicketNumber } from '@/lib/ticket'
import { pendingSaleTotals } from '@/lib/sale-totals'
import type { TenantPrisma } from '@/lib/prisma-tenant'
import { assertNotBilled, lockOpenOrder, type Tx } from '@/lib/restaurante-cuenta'
import { AccountError, OPEN_ACCOUNT_STATUSES } from '@/lib/restaurante-server'

/**
 * Cobro de la cuenta de mesa (R4). La cuenta nunca se cobra aquí: este módulo crea las `Sale` en `pending` con precios del servidor
 * (las líneas salen de OrderItem, modificadores incluidos), y el dinero entra por `PATCH /api/sales/[id]/pay` TAL COMO ESTÁ en main.
 * Una cuenta se cierra cuando todo lo que se pidió quedó cubierto por ventas y todas esas ventas están pagadas (`syncAccount`).
 */

const r2 = (n: number): number => Math.round(n * 100) / 100
const r3 = (n: number): number => Math.round(n * 1000) / 1000
const EPS = 0.0005

/** /pay admite hasta 10 pagos por venta: partes iguales por encima de eso se resuelven dividiendo por ítems. */
export const MAX_SPLIT_PARTS = 10
const LIVE = [{ kds_status: null }, { kds_status: { not: 'void' } }] satisfies Prisma.OrderItemWhereInput[]
const SOLD = ['paid', 'partial_return'] as const

/* ── Esquemas (Zod 4) ── */

const share = z.object({ item_id: z.number().int().positive(), quantity: z.number().positive().max(99999).optional() })
export const chargeSchema = z.union([
  z.object({ kind: z.literal('items'), groups: z.array(z.array(share).min(1).max(100)).min(1).max(MAX_SPLIT_PARTS) }),
  z.object({ kind: z.literal('equal'), parts: z.number().int().min(2).max(MAX_SPLIT_PARTS) }),
])
export const mergeSchema = z.object({ source_id: z.number().int().positive() })
export const transferSchema = z.object({ table_id: z.number().int().positive().optional(), waiter_id: z.number().int().positive().optional() })
  .refine(o => o.table_id !== undefined || o.waiter_id !== undefined, { message: 'Indica la mesa o el mesonero' })
export const tipSchema = z.object({
  sale_id:           z.number().int().positive(),
  payment_method_id: z.number().int().positive(),
  amount_usd:        z.number().positive().max(99_999),
})
export const reopenSchema = z.object({ reason: z.string().trim().max(200).optional() })

export interface Actor { businessId: number; userId: number }

/* ── Cuenta y líneas ── */

type LockedOrder = { id: number; account_status: string | null; price_mode: string; table_id: number | null; waiter_id: number | null; client_id: number | null; client_name: string | null; client_phone: string | null; order_number: string }

async function lock(tx: Tx, businessId: number, orderId: number, statuses: readonly string[]): Promise<LockedOrder> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND business_id = ${businessId} FOR UPDATE`
  const o = await tx.order.findFirst({
    where:  { id: orderId, business_id: businessId, origin: 'table' },
    select: { id: true, account_status: true, price_mode: true, table_id: true, waiter_id: true, client_id: true, client_name: true, client_phone: true, order_number: true },
  })
  if (!o) throw new AccountError(404, 'Cuenta no encontrada')
  if (!statuses.includes(o.account_status ?? '')) throw new AccountError(409, 'La cuenta no está en un estado que permita esta acción')
  return o
}

interface Line { id: number; product_id: number; product_name: string; unit: number; quantity: number; billed: number; billedSub: number; remaining: number; subtotal: number; modifiers: Prisma.JsonValue | null; draft: boolean }

/** Líneas vivas de la cuenta con lo que ya cubren las ventas no canceladas. */
async function lines(tx: Tx, orderId: number): Promise<Line[]> {
  const items = await tx.orderItem.findMany({ where: { order_id: orderId, OR: LIVE }, orderBy: { id: 'asc' } })
  if (items.length === 0) return []
  const billed = await tx.saleItem.groupBy({ by: ['order_item_id'], where: { order_item_id: { in: items.map(i => i.id) }, sale: { status: { not: 'cancelled' } } }, _sum: { quantity: true, subtotal_usd: true } })
  const byItem = new Map(billed.map(b => [b.order_item_id, Number(b._sum.quantity ?? 0)]))
  const bySub = new Map(billed.map(b => [b.order_item_id, Number(b._sum.subtotal_usd ?? 0)]))
  return items.map(i => {
    const q = Number(i.quantity)
    const b = byItem.get(i.id) ?? 0
    return { id: i.id, product_id: i.product_id, product_name: i.product_name, unit: Number(i.price_per_unit_usd), quantity: q, billed: b, billedSub: bySub.get(i.id) ?? 0, remaining: r3(q - b), subtotal: Number(i.subtotal_usd), modifiers: i.modifiers, draft: (i.kds_status ?? 'draft') === 'draft' }
  })
}

/* ── Pedir cuenta ── */

export async function requestBill(db: TenantPrisma, businessId: number, orderId: number, userId: number): Promise<void> {
  await db.$transaction(async (tx: Tx) => {
    const order = await lockOpenOrder(tx, businessId, orderId)
    const ls = await lines(tx, order.id)
    if (ls.length === 0) throw new AccountError(422, 'La cuenta no tiene ítems')
    if (ls.some(l => l.draft)) throw new AccountError(422, 'Hay ítems sin enviar a cocina: envíalos o quítalos antes de pedir la cuenta')
    if (order.account_status === 'bill_requested') return
    await tx.order.update({ where: { id: order.id }, data: { account_status: 'bill_requested', bill_requested_at: new Date() } })
    await tx.tableEvent.create({ data: { business_id: businessId, order_id: order.id, table_id: order.table_id, type: 'bill', user_id: userId } })
  })
}

/* ── Crear ventas pendientes ── */

export interface SaleRef { id: number; ticket_number: string; total_usd: number; total_bs: number; rate_used: number }
export interface ChargeResult { sales: SaleRef[]; parts: Array<{ usd: number }> | null }

/** Porción de una línea: cantidad y subtotal exacto. La última porción de una línea toma el RESIDUAL (sin deriva de centavos). */
type Wanted = Array<{ line: Line; qty: number; sub: number }>

function resolveGroups(ls: readonly Line[], input: z.infer<typeof chargeSchema> | null): Wanted[] {
  const open = ls.filter(l => l.remaining > EPS)
  if (open.length === 0) throw new AccountError(422, 'No queda nada por cobrar en esta cuenta')
  if (input === null || input.kind === 'equal') return [open.map(l => ({ line: l, qty: l.remaining, sub: r2(l.subtotal - l.billedSub) }))]
  const used = new Map<number, number>()
  const usedSub = new Map<number, number>()
  return input.groups.map(group => group.map(s => {
    const line = ls.find(l => l.id === s.item_id)
    if (!line) throw new AccountError(422, 'Un ítem no pertenece a esta cuenta')
    const qty = s.quantity ?? line.remaining
    const taken = (used.get(line.id) ?? 0) + qty
    if (r3(qty) !== qty) throw new AccountError(422, 'Máximo 3 decimales en la cantidad')
    if (taken > line.remaining + EPS) throw new AccountError(422, `«${line.product_name}»: solo quedan ${line.remaining} por cobrar`)
    // Cobertura acumulada: la porción que completa la línea toma el residual; las demás, cantidad × precio unitario.
    const sub = taken >= line.remaining - EPS ? r2(line.subtotal - line.billedSub - (usedSub.get(line.id) ?? 0)) : r2(qty * line.unit)
    if (!(sub > 0)) throw new AccountError(422, `«${line.product_name}»: la porción es demasiado pequeña para cobrarse`)
    used.set(line.id, taken)
    usedSub.set(line.id, r2((usedSub.get(line.id) ?? 0) + sub))
    return { line, qty, sub }
  }))
}

function modsText(m: Prisma.JsonValue | null): string {
  if (!Array.isArray(m)) return ''
  const names = m.flatMap(x => (x && typeof x === 'object' && !Array.isArray(x) && typeof (x as Record<string, unknown>).option === 'string' ? [String((x as Record<string, unknown>).option)] : []))
  return names.length > 0 ? ` (${names.join(', ')})` : ''
}

async function saleRows(tx: Tx, businessId: number, wanted: Wanted, rate: number) {
  const products = await tx.product.findMany({
    where:  { id: { in: Array.from(new Set(wanted.map(w => w.line.product_id))) }, business_id: businessId },
    select: { id: true, sale_mode: true, base_unit_label: true, cost_per_unit_usd: true, product_type: true,
              components: { select: { component_id: true, quantity: true, unit_label: true, component: { select: { id: true, name: true } } } } },
  })
  const byId = new Map(products.map(p => [p.id, p]))
  return wanted.map(({ line, qty, sub }) => {
    const p = byId.get(line.product_id)
    if (!p) throw new AccountError(409, `El producto «${line.product_name}» ya no existe`)
    const subtotal = sub
    return {
      product_id: line.product_id, product_name: `${line.product_name}${modsText(line.modifiers)}`.slice(0, 120),
      sale_mode: p.sale_mode, unit_label: p.base_unit_label ?? 'und', quantity: qty, price_per_unit_usd: line.unit,
      cost_per_unit_usd: p.cost_per_unit_usd != null ? Number(p.cost_per_unit_usd) : null,
      subtotal_usd: subtotal, subtotal_bs: r2(subtotal * rate), rate_used: rate, discount_usd: 0, order_item_id: line.id,
      recipe_snapshot: p.product_type !== 'simple' && p.components.length > 0
        ? JSON.stringify(p.components.map(c => ({ component_id: c.component_id, component_name: c.component.name, quantity: c.quantity, unit_label: c.unit_label })))
        : null,
    }
  })
}

/** Reparte `total` en `n` partes de centavos exactos; el resto va a la primera. */
export function equalParts(total: number, n: number): number[] {
  const base = Math.floor((total * 100) / n) / 100
  const first = r2(total - base * (n - 1))
  return [first, ...Array.from({ length: n - 1 }, () => base)]
}

/**
 * Crea las ventas `pending` de la cuenta: todo lo que falta (cobrar o partes iguales) o los grupos de ítems pedidos (dividir).
 * Exige caja abierta (como el POS) y la cuenta completa: sin ítems en borrador. `rate` viene del servidor (getActiveRate, 4 decimales).
 */
export async function createCharges(db: TenantPrisma, actor: Actor, orderId: number, rate: number, input: z.infer<typeof chargeSchema> | null): Promise<ChargeResult> {
  return db.$transaction(async (tx: Tx) => {
    const order = await lock(tx, actor.businessId, orderId, OPEN_ACCOUNT_STATUSES)
    // Igual que el POS: con caja_mode 'nocash' (negocio sin turnos) la caja nunca bloquea el cobro.
    const business = await tx.business.findUnique({ where: { id: actor.businessId }, select: { caja_mode: true } })
    const register = business?.caja_mode === 'nocash' ? { id: 0 } : await tx.cashRegister.findFirst({ where: { business_id: actor.businessId, closed_at: null }, select: { id: true } })
    if (!register) throw new AccountError(409, 'No hay caja abierta: abre la caja para cobrar', { code: 'CAJA_CERRADA' })

    const ls = await lines(tx, order.id)
    if (ls.some(l => l.draft)) throw new AccountError(422, 'Hay ítems sin enviar a cocina: envíalos o quítalos antes de cobrar')
    const groups = resolveGroups(ls, input)
    // El recibo imprime la nota de la venta: mesa y mesonero viajan ahí (el ticket no se toca).
    const where = await tx.order.findFirst({ where: { id: order.id }, select: { table: { select: { label: true } }, waiter: { select: { name: true } } } })
    const note = [where?.table ? `Mesa ${where.table.label}` : null, where?.waiter?.name ? `Mesonero ${where.waiter.name}` : null, `Cuenta ${order.order_number}`].filter(Boolean).join(' · ')

    const refs: SaleRef[] = []
    for (const wanted of groups) {
      const rows = await saleRows(tx, actor.businessId, wanted, rate)
      const totals = pendingSaleTotals(rows.reduce((a, x) => a + x.subtotal_usd, 0), 0, 0, rate)
      const ticket = await generateTicketNumber(actor.businessId, tx as unknown as Parameters<typeof generateTicketNumber>[1])
      const sale = await tx.sale.create({
        data: {
          business_id: actor.businessId, cashier_id: actor.userId, ticket_number: ticket, status: 'pending', origin: 'pos',
          price_mode: order.price_mode, total_usd: totals.total_usd, total_bs: totals.total_bs, rate_used: rate,
          client_id: order.client_id, client_name: order.client_name, client_phone: order.client_phone,
          notes: note, table_order_id: order.id, items: { create: rows },
        },
        select: { id: true, ticket_number: true, total_usd: true, total_bs: true, rate_used: true },
      })
      refs.push({ id: sale.id, ticket_number: sale.ticket_number, total_usd: Number(sale.total_usd), total_bs: Number(sale.total_bs), rate_used: Number(sale.rate_used) })
    }
    if (order.account_status === 'open') {
      await tx.order.update({ where: { id: order.id }, data: { account_status: 'bill_requested', bill_requested_at: new Date() } })
    }
    const parts = input !== null && input.kind === 'equal' ? equalParts(refs[0].total_usd, input.parts).map(usd => ({ usd })) : null
    return { sales: refs, parts }
  })
}

/* ── Cerrar / reabrir ── */

/**
 * Cierra la cuenta si todo lo pedido quedó cubierto por ventas y todas están pagadas. Idempotente: se llama tras cada pago.
 * Al cerrar, la mesa (y las unidas) pasan a "por limpiar"; la cuenta queda `closed` y el pedido `delivered`.
 */
export async function syncAccount(db: TenantPrisma, businessId: number, userId: number, orderId: number): Promise<{ closed: boolean }> {
  return db.$transaction(async (tx: Tx) => {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND business_id = ${businessId} FOR UPDATE`
    const order = await tx.order.findFirst({ where: { id: orderId, business_id: businessId, origin: 'table' }, select: { id: true, account_status: true, table_id: true, joined_tables: { select: { table_id: true } } } })
    if (!order) throw new AccountError(404, 'Cuenta no encontrada')
    if (order.account_status === 'closed') return { closed: true }
    if (order.account_status !== 'open' && order.account_status !== 'bill_requested') return { closed: false }

    const ls = await lines(tx, order.id)
    const sales = await tx.sale.findMany({ where: { table_order_id: order.id, status: { not: 'cancelled' } }, select: { status: true } })
    const covered = ls.length > 0 && ls.every(l => !l.draft && l.remaining <= EPS)
    const paid = sales.length > 0 && sales.every(s => (SOLD as readonly string[]).includes(s.status))
    if (!covered || !paid) return { closed: false }

    const tableIds = [order.table_id, ...order.joined_tables.map(j => j.table_id)].filter((t): t is number => t !== null)
    await tx.order.update({ where: { id: order.id }, data: { account_status: 'closed', status: 'delivered', closed_at: new Date() } })
    await tx.diningTable.updateMany({ where: { id: { in: tableIds }, business_id: businessId }, data: { cleaning_pending: true } })
    await tx.tableEvent.create({ data: { business_id: businessId, order_id: order.id, table_id: order.table_id, type: 'close', user_id: userId } })
    return { closed: true }
  })
}

/**
 * Reabre una cuenta (solo admin, lo exige la ruta): cancela las ventas todavía pendientes y deja la cuenta en `open`. Si hay ventas
 * pagadas hay que anularlas primero con la anulación de ventas del POS (que repone stock); las canceladas ya no cuentan.
 */
export async function reopenAccount(db: TenantPrisma, businessId: number, userId: number, orderId: number, reason: string | null): Promise<void> {
  await db.$transaction(async (tx: Tx) => {
    const order = await lock(tx, businessId, orderId, ['open', 'bill_requested', 'closed'])
    // Cerrojo de las ventas de la cuenta: /pay también las bloquea, así que no se cruzan un cobro y la cancelación.
    await tx.$queryRaw`SELECT id FROM sales WHERE table_order_id = ${order.id} AND business_id = ${businessId} FOR UPDATE`
    const sales = await tx.sale.findMany({ where: { table_order_id: order.id, status: { not: 'cancelled' } }, select: { id: true, status: true } })
    if (sales.some(s => s.status !== 'pending')) throw new AccountError(409, 'Hay ventas pagadas: anúlalas primero (la anulación repone el inventario) y luego reabre la cuenta')
    if (order.account_status === 'closed' && order.table_id !== null) {
      const taken = await tx.order.findFirst({ where: { business_id: businessId, id: { not: order.id }, table_id: order.table_id, account_status: { in: [...OPEN_ACCOUNT_STATUSES] } }, select: { id: true } })
      if (taken) throw new AccountError(409, 'La mesa ya tiene otra cuenta abierta')
    }
    if (sales.length > 0) {
      const done = await tx.sale.updateMany({ where: { id: { in: sales.map(s => s.id) }, business_id: businessId, status: 'pending' }, data: { status: 'cancelled' } })
      if (done.count !== sales.length) throw new AccountError(409, 'Un cobro cambió mientras se reabría: intenta de nuevo')
    }
    await tx.order.update({ where: { id: order.id }, data: { account_status: 'open', status: 'received', closed_at: null, bill_requested_at: null } })
    if (order.table_id !== null) await tx.diningTable.updateMany({ where: { id: order.table_id, business_id: businessId }, data: { cleaning_pending: false } })
    await tx.tableEvent.create({ data: { business_id: businessId, order_id: order.id, table_id: order.table_id, type: 'reopen', reason, user_id: userId } })
  })
}

/* ── Propina ── */

/** Propina de una venta de mesa. Va aparte: no entra en sales.total_usd, así que las ventas netas no cambian. Solo el efectivo mueve el cajón. */
export async function addTip(db: TenantPrisma, actor: Actor, input: z.infer<typeof tipSchema>): Promise<{ id: number }> {
  const sale = await db.sale.findFirst({ where: { id: input.sale_id, table_order_id: { not: null } }, select: { id: true, status: true, rate_used: true, total_usd: true, table_order: { select: { waiter_id: true } } } })
  if (!sale) throw new AccountError(404, 'Venta de mesa no encontrada')
  // Solo sobre una venta cobrada: la propina de una venta que aún no se paga no tiene respaldo en caja.
  if (!(SOLD as readonly string[]).includes(sale.status)) throw new AccountError(409, 'La propina se registra después de cobrar la venta')
  const prev = await db.saleTip.aggregate({ where: { sale_id: sale.id }, _sum: { amount_usd: true } })
  if (Number(prev._sum.amount_usd ?? 0) + input.amount_usd > Number(sale.total_usd) + 0.005) throw new AccountError(422, 'La propina no puede superar el total de la venta')
  const dup = await db.saleTip.findFirst({ where: { sale_id: sale.id, payment_method_id: input.payment_method_id, amount_usd: r2(input.amount_usd), created_at: { gte: new Date(Date.now() - 5000) } }, select: { id: true } })
  if (dup) throw new AccountError(409, 'Esa propina ya se registró hace un momento')
  const method = await db.paymentMethod.findFirst({ where: { id: input.payment_method_id, is_active: true, is_financing: false }, select: { id: true, type: true } })
  if (!method) throw new AccountError(422, 'Método de pago no válido para la propina')
  const rate = Number(sale.rate_used)
  return db.saleTip.create({
    data: {
      business_id: actor.businessId, sale_id: sale.id, waiter_id: sale.table_order?.waiter_id ?? null, payment_method_id: method.id, is_cash: method.type === 'cash',
      amount_usd: r2(input.amount_usd), amount_bs: r2(input.amount_usd * rate), rate_used: rate, created_by: actor.userId,
    },
    select: { id: true },
  })
}

/* ── Juntar y transferir ── */

/** Une la cuenta `sourceId` a `targetId`: sus ítems pasan a la cuenta destino y su mesa queda unida a ella. Ninguna debe tener cobros. */
export async function mergeAccounts(db: TenantPrisma, businessId: number, userId: number, targetId: number, sourceId: number): Promise<void> {
  if (targetId === sourceId) throw new AccountError(422, 'Elige otra cuenta para juntar')
  await db.$transaction(async (tx: Tx) => {
    const [first, second] = targetId < sourceId ? [targetId, sourceId] : [sourceId, targetId] // orden fijo: sin deadlock entre dos juntar cruzados
    await lock(tx, businessId, first, OPEN_ACCOUNT_STATUSES)
    await lock(tx, businessId, second, OPEN_ACCOUNT_STATUSES)
    await assertNotBilled(tx, targetId)
    await assertNotBilled(tx, sourceId)
    const [target, source] = await Promise.all([
      tx.order.findFirstOrThrow({ where: { id: targetId, business_id: businessId }, select: { id: true, table_id: true, rate_used: true, price_mode: true } }),
      tx.order.findFirstOrThrow({ where: { id: sourceId, business_id: businessId }, select: { id: true, table_id: true, price_mode: true, joined_tables: { select: { table_id: true } } } }),
    ])
    if (target.price_mode !== source.price_mode) throw new AccountError(422, 'Las cuentas usan modo de precio distinto: no se pueden juntar')
    await tx.orderItem.updateMany({ where: { order_id: source.id }, data: { order_id: target.id, kds_updated_at: new Date() } })
    const agg = await tx.orderItem.aggregate({ where: { order_id: target.id, OR: LIVE }, _sum: { subtotal_usd: true } })
    const total = r2(Number(agg._sum.subtotal_usd ?? 0))
    await tx.order.update({ where: { id: target.id }, data: { total_usd: total, total_bs: r2(total * Number(target.rate_used)), account_status: 'open', bill_requested_at: null } })
    const moved = [source.table_id, ...source.joined_tables.map(j => j.table_id)].filter((t): t is number => t !== null)
    await tx.orderTable.deleteMany({ where: { order_id: source.id } })
    await tx.orderTable.createMany({ data: moved.map(table_id => ({ order_id: target.id, table_id })), skipDuplicates: true })
    await tx.order.update({ where: { id: source.id }, data: { account_status: 'void', status: 'cancelled', total_usd: 0, total_bs: 0, closed_at: new Date() } })
    await tx.tableEvent.create({ data: { business_id: businessId, order_id: target.id, table_id: target.table_id, type: 'merge', from_value: String(source.id), to_value: String(target.id), user_id: userId } })
  })
}

/** Cambia la cuenta de mesa o de mesonero. La mesa destino debe estar libre (sin cuenta abierta ni unida). */
export async function transferAccount(db: TenantPrisma, businessId: number, userId: number, role: string, orderId: number, input: z.infer<typeof transferSchema>): Promise<void> {
  if (input.waiter_id !== undefined && role === 'waiter') throw new AccountError(403, 'Cambiar de mesonero lo hace un cajero o un administrador')
  await db.$transaction(async (tx: Tx) => {
    const order = await lock(tx, businessId, orderId, OPEN_ACCOUNT_STATUSES)
    if (input.table_id !== undefined && input.table_id !== order.table_id) {
      const table = await tx.diningTable.findFirst({ where: { id: input.table_id, business_id: businessId, active: true }, select: { id: true, label: true } })
      if (!table) throw new AccountError(404, 'Mesa no encontrada')
      const busy = await tx.order.findFirst({ where: { business_id: businessId, account_status: { in: [...OPEN_ACCOUNT_STATUSES] }, OR: [{ table_id: table.id }, { joined_tables: { some: { table_id: table.id } } }] }, select: { id: true } })
      if (busy) throw new AccountError(409, 'La mesa destino ya tiene una cuenta abierta', { account_id: busy.id })
      await tx.order.update({ where: { id: order.id }, data: { table_id: table.id } })
      await tx.tableEvent.create({ data: { business_id: businessId, order_id: order.id, table_id: table.id, type: 'transfer_table', from_value: String(order.table_id), to_value: String(table.id), user_id: userId } })
    }
    if (input.waiter_id !== undefined && input.waiter_id !== order.waiter_id) {
      const waiter = await tx.user.findFirst({ where: { id: input.waiter_id, business_id: businessId, is_active: true, role: { in: ['waiter', 'admin', 'cashier'] } }, select: { id: true } })
      if (!waiter) throw new AccountError(422, 'Mesonero no válido')
      await tx.order.update({ where: { id: order.id }, data: { waiter_id: waiter.id } })
      await tx.tableEvent.create({ data: { business_id: businessId, order_id: order.id, table_id: order.table_id, type: 'transfer_waiter', from_value: String(order.waiter_id), to_value: String(waiter.id), user_id: userId } })
    }
  })
}
