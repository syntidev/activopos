import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { getActiveRate } from '@/lib/bcv'
import { resolveLinePrice } from '@/lib/pricing'
import { parseSearch, productSearchWhere } from '@/lib/product-search'
import type { TenantPrisma } from '@/lib/prisma-tenant'
import { AccountError, OPEN_ACCOUNT_STATUSES } from '@/lib/restaurante-server'
import type {
  AccountDTO, AccountItemDTO, AccountStatus, AccountSummaryDTO, CatalogDTO, ItemKdsStatus, ItemModifierDTO, ModifierDTO,
} from '@/types/restaurante'

/**
 * Cuenta de mesa del módulo Restaurante (R2). Una cuenta ES un Order con origin = 'table'; cada línea es un OrderItem.
 * REGLA SELLADA: el cliente nunca manda precios. Producto + cantidad + ids de modificadores → el precio sale de la DB.
 * El mesonero no cobra ni ve costos: nada de aquí devuelve cost_*.
 */

/** Cliente de transacción del cliente con scope de tenant (no es Prisma.TransactionClient: lleva las extensiones). */
export type Tx = Parameters<Extract<Parameters<TenantPrisma['$transaction']>[0], (...args: never[]) => unknown>>[0]

const round2 = (n: number): number => Math.round(n * 100) / 100
const round4 = (n: number): number => Math.round(n * 10_000) / 10_000
/** Modos de venta que admiten cantidad decimal; el resto (unit, service, package) exige enteros. */
const DECIMAL_MODES = new Set(['weight', 'length', 'volume'])
const ROLES_PUEDEN_ATENDER = ['admin', 'super_admin', 'cashier', 'waiter'] as const

/* ── Esquemas (Zod 4) ── */

export const openAccountSchema = z.object({
  table_id:      z.number().int().positive(),
  guests:        z.number().int().min(1).max(60),
  waiter_id:     z.number().int().positive().optional(),
  client_name:   z.string().trim().max(120).optional(),
  confirm_clean: z.boolean().optional(),
})

/** Sin price_*: cualquier precio que mande el cliente se descarta (Zod quita las claves desconocidas). */
export const addItemSchema = z.object({
  product_id:   z.number().int().positive(),
  quantity:     z.number().positive().max(999),
  modifier_ids: z.array(z.number().int().positive()).max(30).optional(),
  note:         z.string().trim().max(120).nullish(),
  course:       z.number().int().min(1).max(3).optional(),
})

export const voidItemSchema = z.object({ reason: z.string().trim().max(120).optional() })

const modifierBase = z.object({
  product_id:  z.number().int().positive().nullish(),
  category_id: z.number().int().positive().nullish(),
  group_name:  z.string().trim().min(1).max(60).nullish(),
  name:        z.string().trim().min(1).max(60),
  price_usd:   z.number().min(0).max(9999),
  required:    z.boolean().optional(),
  sort_order:  z.number().int().min(0).max(999).optional(),
})
const oneScope = (o: { product_id?: number | null; category_id?: number | null }): boolean => !(o.product_id && o.category_id)
export const modifierCreateSchema = modifierBase.refine(oneScope, { message: 'Elige un producto o una categoría, no ambos' })
export const modifierPatchSchema = modifierBase.partial().extend({ active: z.boolean().optional() })
  .refine(o => Object.keys(o).length > 0, { message: 'Nada que actualizar' })
  .refine(oneScope, { message: 'Elige un producto o una categoría, no ambos' })

/* ── Serialización ── */

export const ACCOUNT_INCLUDE = {
  table:  { select: { label: true, area: { select: { name: true } } } },
  waiter: { select: { name: true } },
  items:  { orderBy: { id: 'asc' } },
} satisfies Prisma.OrderInclude
type AccountRow = Prisma.OrderGetPayload<{ include: typeof ACCOUNT_INCLUDE }>

function parseModifiers(json: Prisma.JsonValue | null): ItemModifierDTO[] {
  if (!Array.isArray(json)) return []
  const out: ItemModifierDTO[] = []
  for (const m of json) {
    if (m && typeof m === 'object' && !Array.isArray(m)) {
      const r = m as Record<string, Prisma.JsonValue>
      out.push({ group: typeof r.group === 'string' ? r.group : '', option: typeof r.option === 'string' ? r.option : '', price_usd: Number(r.price_usd ?? 0) })
    }
  }
  return out
}

function toItem(i: AccountRow['items'][number]): AccountItemDTO {
  return {
    id: i.id, product_id: i.product_id, product_name: i.product_name, quantity: Number(i.quantity),
    price_per_unit_usd: Number(i.price_per_unit_usd), subtotal_usd: Number(i.subtotal_usd),
    note: i.note, modifiers: parseModifiers(i.modifiers), course: i.course,
    kds_status: (i.kds_status ?? 'draft') as ItemKdsStatus, void_reason: i.void_reason,
  }
}

function toSummary(o: Omit<AccountRow, 'items'>): AccountSummaryDTO {
  return {
    id: o.id, order_number: o.order_number, table_id: o.table_id, table_label: o.table?.label ?? null,
    area_name: o.table?.area.name ?? null, status: (o.account_status ?? 'open') as AccountStatus, guests: o.guests,
    waiter_name: o.waiter?.name ?? null, client_name: o.client_name,
    total_usd: Number(o.total_usd), total_bs: Number(o.total_bs), opened_at: o.opened_at ? o.opened_at.toISOString() : null,
  }
}

export function toAccount(o: AccountRow): AccountDTO {
  return {
    ...toSummary(o), waiter_id: o.waiter_id, bill_requested_at: o.bill_requested_at ? o.bill_requested_at.toISOString() : null,
    rate_used: Number(o.rate_used), items: o.items.map(toItem),
  }
}

/** Cuenta de mesa del negocio de la sesión (el scope de tenant ya filtra por business_id). 404 si no existe o es de otro negocio. */
export async function loadAccount(db: TenantPrisma, id: number): Promise<AccountDTO> {
  const row = await db.order.findFirst({ where: { id, origin: 'table' }, include: ACCOUNT_INCLUDE })
  if (!row) throw new AccountError(404, 'Cuenta no encontrada')
  return toAccount(row)
}

/* ── Búsqueda de cuentas ── */

/** AND entre palabras, OR entre campos: nº de cuenta, cliente, teléfono, mesa, área, mesonero o un producto de la cuenta. */
export function accountsBySearch(tokens: readonly string[]): Prisma.OrderWhereInput {
  return {
    AND: tokens.map(token => ({
      OR: [
        { order_number: { contains: token } },
        { client_name:  { contains: token } },
        { client_phone: { contains: token } },
        { table:  { label: { contains: token } } },
        { table:  { area: { name: { contains: token } } } },
        { waiter: { name: { contains: token } } },
        { items:  { some: { product_name: { contains: token } } } },
      ],
    })),
  }
}

export async function listAccounts(db: TenantPrisma, opts: { tokens: readonly string[]; statuses: readonly AccountStatus[] }): Promise<AccountSummaryDTO[]> {
  const rows = await db.order.findMany({
    where:   { origin: 'table', account_status: { in: [...opts.statuses] }, ...accountsBySearch(opts.tokens) },
    include: { table: ACCOUNT_INCLUDE.table, waiter: ACCOUNT_INCLUDE.waiter },
    orderBy: { id: 'desc' },
    take:    100,
  })
  return rows.map(toSummary)
}

/** ¿La mesa tiene una cuenta abierta? Bloquea eliminarla o desactivarla. */
export async function tableOpenAccountId(db: TenantPrisma, tableId: number): Promise<number | null> {
  const open = await db.order.findFirst({ where: { table_id: tableId, account_status: { in: [...OPEN_ACCOUNT_STATUSES] } }, select: { id: true } })
  return open?.id ?? null
}

/* ── Abrir cuenta ── */

export interface OpenAccountInput { tableId: number; guests: number; waiterId: number; clientName: string | null; confirmClean: boolean }

/**
 * Abre la cuenta de una mesa. La fila de la mesa se bloquea (FOR UPDATE): dos dispositivos a la vez → el segundo recibe 409
 * con el id de la cuenta existente, nunca dos cuentas. Sin tasa del día usa la última guardada: no se bloquea por la tasa.
 */
export async function openAccount(db: TenantPrisma, businessId: number, userId: number, input: OpenAccountInput): Promise<number> {
  const { rate } = await getActiveRate(businessId)

  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx: Tx) => {
        const locked = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM dining_tables WHERE id = ${input.tableId} AND business_id = ${businessId} FOR UPDATE`
        if (locked.length === 0) throw new AccountError(404, 'Mesa no encontrada')
        const table = await tx.diningTable.findFirst({ where: { id: input.tableId, business_id: businessId, active: true }, include: { area: { select: { active: true } } } })
        if (!table || !table.area.active) throw new AccountError(404, 'Mesa no encontrada')

        const existing = await tx.order.findFirst({
          where: { business_id: businessId, table_id: table.id, account_status: { in: [...OPEN_ACCOUNT_STATUSES] } }, select: { id: true },
        })
        if (existing) throw new AccountError(409, 'La mesa ya tiene una cuenta abierta', { code: 'TABLE_OCCUPIED', account_id: existing.id })
        if (table.cleaning_pending && !input.confirmClean) {
          throw new AccountError(409, 'La mesa está marcada por limpiar. ¿Ya está limpia?', { code: 'NEEDS_CLEAN_CONFIRM' })
        }
        if (input.guests > table.capacity + 4) {
          throw new AccountError(422, `Máximo ${table.capacity + 4} comensales en esta mesa (capacidad ${table.capacity} + 4)`)
        }
        const waiter = await tx.user.findFirst({
          where: { id: input.waiterId, business_id: businessId, is_active: true, role: { in: [...ROLES_PUEDEN_ATENDER] } }, select: { id: true },
        })
        if (!waiter) throw new AccountError(422, 'Mesonero no válido')

        const last = await tx.order.findFirst({ where: { business_id: businessId }, orderBy: { id: 'desc' }, select: { id: true } })
        const order = await tx.order.create({
          data: {
            business_id: businessId, order_number: `PED-${String((last?.id ?? 0) + 1 + attempt).padStart(5, '0')}`,
            status: 'received', origin: 'table', client_name: input.clientName, price_mode: 'bcv',
            total_usd: 0, total_bs: 0, rate_used: rate, send_to_kds: false,
            table_id: table.id, guests: input.guests, waiter_id: waiter.id, account_status: 'open', opened_at: new Date(),
          },
        })
        // Al sentarse, la mesa deja de estar reservada o por limpiar.
        await tx.diningTable.update({ where: { id: table.id }, data: { cleaning_pending: false, reserved_for: null, reserved_phone: null, reserved_at: null } })
        await tx.tableEvent.create({ data: { business_id: businessId, order_id: order.id, table_id: table.id, type: 'open', to_value: String(input.guests), user_id: userId } })
        return order.id
      })
    } catch (err) {
      // Dos aperturas distintas pueden pedir el mismo número de pedido: se reintenta con el siguiente.
      if ((err as { code?: string } | null)?.code === 'P2002' && attempt < 3) continue
      throw err
    }
  }
}

/* ── Totales ── */

/** Recalcula total_usd/total_bs de la cuenta con las líneas no anuladas y la tasa con que se abrió. */
async function recalcTotals(tx: Tx, orderId: number, rate: number): Promise<void> {
  const agg = await tx.orderItem.aggregate({ where: { order_id: orderId, kds_status: { not: 'void' } }, _sum: { subtotal_usd: true } })
  const total = round2(Number(agg._sum.subtotal_usd ?? 0))
  await tx.order.update({ where: { id: orderId }, data: { total_usd: total, total_bs: round2(total * rate) } })
}

/** Cuenta editable (open o bill_requested) del negocio, con su fila bloqueada. 404 si no existe; 409 si ya está cerrada. */
export async function lockOpenOrder(tx: Tx, businessId: number, orderId: number): Promise<{ id: number; account_status: string | null; rate_used: Prisma.Decimal; price_mode: string; table_id: number | null }> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND business_id = ${businessId} FOR UPDATE`
  const order = await tx.order.findFirst({
    where: { id: orderId, business_id: businessId, origin: 'table' },
    select: { id: true, account_status: true, rate_used: true, price_mode: true, table_id: true },
  })
  if (!order) throw new AccountError(404, 'Cuenta no encontrada')
  if (order.account_status !== 'open' && order.account_status !== 'bill_requested') throw new AccountError(409, 'La cuenta ya está cerrada')
  return order
}

/* ── Agregar ítem ── */

export interface AddItemInput { productId: number; quantity: number; modifierIds: number[]; note: string | null; course: number }

/**
 * Agrega un ítem borrador. PRECIO: base del producto (resolveLinePrice, el mismo de /api/orders) + extras de los modificadores
 * leídos de la DB. Producto, modificadores y cuenta se validan contra el negocio de la sesión.
 */
export async function addItem(db: TenantPrisma, businessId: number, orderId: number, userId: number, input: AddItemInput): Promise<void> {
  await db.$transaction(async (tx: Tx) => {
    const order = await lockOpenOrder(tx, businessId, orderId)

    const product = await tx.product.findFirst({
      where: { id: input.productId, business_id: businessId, active: true },
      select: { id: true, name: true, sale_mode: true, category_id: true, price_per_unit_usd: true, price_per_kg_usd: true, wholesale_price_usd: true, wholesale_price_per_kg_usd: true },
    })
    if (!product) throw new AccountError(404, 'Producto no encontrado o inactivo')

    if (!DECIMAL_MODES.has(product.sale_mode) && !Number.isInteger(input.quantity)) {
      throw new AccountError(422, 'Este producto se vende por unidad: la cantidad debe ser un número entero')
    }
    if (Math.round(input.quantity * 1000) / 1000 !== input.quantity) throw new AccountError(422, 'Máximo 3 decimales en la cantidad')

    const base = resolveLinePrice(product, undefined, { mode: order.price_mode === 'divisa' ? 'divisa' : 'bcv', saleMode: product.sale_mode })
    if (!(base.price > 0)) throw new AccountError(422, 'El producto no tiene precio configurado')

    // Modificadores aplicables: del negocio, activos y para todo el negocio, esta categoría o este producto.
    const applicable = await tx.productModifier.findMany({
      where: {
        business_id: businessId, active: true,
        OR: [{ product_id: null, category_id: null }, { product_id: product.id }, ...(product.category_id ? [{ category_id: product.category_id }] : [])],
      },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    })
    const chosenIds = Array.from(new Set(input.modifierIds))
    const chosen = applicable.filter(m => chosenIds.includes(m.id))
    if (chosen.length !== chosenIds.length) throw new AccountError(422, 'Modificador no válido para este producto')

    // Un modificador obligatorio exige elegir una opción de su grupo (suelto: ese mismo).
    for (const m of applicable.filter(a => a.required)) {
      const ok = m.group_name ? chosen.some(c => c.group_name === m.group_name) : chosen.some(c => c.id === m.id)
      if (!ok) throw new AccountError(422, m.group_name ? `Elige una opción de «${m.group_name}»` : `«${m.name}» es obligatorio`)
    }

    const extras = chosen.reduce((sum, m) => sum + Number(m.price_usd), 0)
    const unit = round4(base.price + extras)
    await tx.orderItem.create({
      data: {
        order_id: order.id, product_id: product.id, product_name: product.name, quantity: input.quantity,
        price_per_unit_usd: unit, subtotal_usd: round2(input.quantity * unit), price_source: base.source,
        note: input.note ?? null,
        modifiers: chosen.map(m => ({ group: m.group_name ?? '', option: m.name, price_usd: Number(m.price_usd) })),
        course: input.course, kds_status: 'draft',
      },
    })

    await recalcTotals(tx, order.id, Number(order.rate_used))
    // Pedir algo más después de pedir la cuenta la reabre.
    if (order.account_status === 'bill_requested') {
      await tx.order.update({ where: { id: order.id }, data: { account_status: 'open', bill_requested_at: null } })
      await tx.tableEvent.create({ data: { business_id: businessId, order_id: order.id, table_id: order.table_id, type: 'reopen', user_id: userId } })
    }
  })
}

/* ── Anular ítem: un borrador lo quita cualquiera; uno ya enviado a cocina solo un administrador; uno servido no se anula ── */

export async function voidDraftItem(
  db: TenantPrisma, businessId: number, orderId: number, itemId: number, user: { id: number; role: string }, reason: string | undefined,
): Promise<void> {
  const userId = user.id
  await db.$transaction(async (tx: Tx) => {
    const order = await lockOpenOrder(tx, businessId, orderId)
    // OrderItem no tiene business_id: se aísla por la cuenta (ya validada contra el negocio de la sesión).
    const item = await tx.orderItem.findFirst({ where: { id: itemId, order_id: order.id } })
    if (!item) throw new AccountError(404, 'Ítem no encontrado')
    const st = item.kds_status
    if (st === 'void' || st === 'served') throw new AccountError(422, st === 'void' ? 'El ítem ya está anulado' : 'Un ítem ya servido no se anula')
    if (st !== 'draft' && user.role !== 'admin' && user.role !== 'super_admin') {
      throw new AccountError(403, 'Anular un ítem que ya se envió a cocina requiere autorización de un administrador')
    }

    await tx.orderItem.update({
      where: { id: item.id },
      data:  { kds_status: 'void', void_by: userId, void_reason: reason ?? (st === 'draft' ? 'Quitado por el mesonero' : 'Anulado por un administrador'), kds_updated_at: new Date() },
    })
    await recalcTotals(tx, order.id, Number(order.rate_used))
    await tx.tableEvent.create({ data: { business_id: businessId, order_id: order.id, table_id: order.table_id, type: 'void_item', from_value: item.product_name.slice(0, 60), reason: reason ?? null, user_id: userId } })
  })
}

/* ── Catálogo del mesonero ── */

const CATALOG_LIMIT = 60

export function toModifier(m: Prisma.ProductModifierGetPayload<object>): ModifierDTO {
  return {
    id: m.id, product_id: m.product_id, category_id: m.category_id, group_name: m.group_name, name: m.name,
    price_usd: Number(m.price_usd), required: m.required, active: m.active, sort_order: m.sort_order,
  }
}

/**
 * Productos activos con su precio de venta y sus modificadores, más la tasa para mostrar USD y Bs juntos.
 * Es lo único que ve el mesonero de la carta: ningún costo, margen ni proveedor sale de aquí.
 */
export async function loadCatalog(db: TenantPrisma, businessId: number, q: string | null, categoryId: number | null): Promise<CatalogDTO> {
  const search = productSearchWhere(parseSearch(q))
  const [{ rate }, categories, modifiers, rows] = await Promise.all([
    getActiveRate(businessId),
    db.category.findMany({ where: { active: true }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
    db.productModifier.findMany({ where: { active: true }, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] }),
    db.product.findMany({
      where: { active: true, ...(categoryId ? { category_id: categoryId } : {}), ...(search ?? {}) },
      orderBy: { name: 'asc' }, take: CATALOG_LIMIT,
      select: {
        id: true, name: true, sale_mode: true, category_id: true, category: { select: { name: true } },
        price_per_unit_usd: true, price_per_kg_usd: true, wholesale_price_usd: true, wholesale_price_per_kg_usd: true,
      },
    }),
  ])
  const all = modifiers.map(toModifier)
  return {
    rate, categories,
    products: rows.map(p => ({
      id: p.id, name: p.name, sale_mode: p.sale_mode, category_id: p.category_id, category_name: p.category?.name ?? null,
      price_usd: resolveLinePrice(p, undefined, { mode: 'bcv', saleMode: p.sale_mode }).price,
      modifiers: all.filter(m => (m.product_id === null && m.category_id === null) || m.product_id === p.id || (p.category_id !== null && m.category_id === p.category_id)),
    })),
  }
}
