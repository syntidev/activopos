import type { Prisma, PrismaClient } from '@prisma/client'
import { businessDateKey } from '@/lib/business-day'

type Db = Prisma.TransactionClient | PrismaClient

/** Opción elegida, ya con el precio del SERVIDOR (el cliente solo manda ids). Es el snapshot que se guarda en order_items.modifiers. */
// type (no interface): Prisma exige que el valor sea asignable a JSON, y solo un type alias tiene firma de índice implícita.
export type ChosenOption = {
  group_id:  number
  option_id: number
  group:     string
  option:    string
  price_usd: number
}

export class OptionError extends Error {
  constructor(readonly status: number, message: string, readonly field?: string) { super(message) }
}

/**
 * Valida las opciones de un plato contra SUS grupos activos y calcula el extra. Reglas: una opción ajena o inactiva se rechaza (422);
 * un grupo obligatorio sin elección se rechaza; un grupo de elección única no admite 2; con elección múltiple se respeta max_select.
 */
export async function resolveOptions(db: Db, productId: number, optionIds: readonly number[]): Promise<{ chosen: ChosenOption[]; extraUsd: number }> {
  const groups = await db.productOptionGroup.findMany({
    where:   { product_id: productId, is_active: true },
    include: { options: { where: { is_active: true }, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] } },
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
  })
  const ids = Array.from(new Set(optionIds))
  const known = new Map(groups.flatMap(g => g.options.map(o => [o.id, { g, o }] as const)))
  if (ids.some(id => !known.has(id))) throw new OptionError(422, 'Una de las opciones elegidas no es válida para este plato.', 'options')

  const chosen: ChosenOption[] = []
  for (const g of groups) {
    const picked = g.options.filter(o => ids.includes(o.id))
    if (g.required && picked.length === 0) throw new OptionError(422, 'Elige ' + g.name + '.', 'options')
    if (!g.multiple && picked.length > 1) throw new OptionError(422, g.name + ': elige solo una opción.', 'options')
    if (g.multiple && g.max_select !== null && picked.length > g.max_select) throw new OptionError(422, g.name + ': máximo ' + g.max_select + '.', 'options')
    for (const o of picked) chosen.push({ group_id: g.id, option_id: o.id, group: g.name, option: o.name, price_usd: Number(o.price_extra_usd) })
  }
  const extraUsd = Math.round(chosen.reduce((s, c) => s + c.price_usd, 0) * 100) / 100
  return { chosen, extraUsd }
}

/** Suma de los extras guardados en order_items.modifiers (snapshot). El repricing de un pedido NO puede perderlos. */
export function modifiersExtraUsd(raw: unknown): number {
  if (!Array.isArray(raw)) return 0
  const sum = raw.reduce<number>((s, m) => s + (typeof (m as { price_usd?: unknown } | null)?.price_usd === 'number' ? (m as { price_usd: number }).price_usd : 0), 0)
  return Math.round(sum * 100) / 100
}

/** Agotado del día: sold_out_date es el día de negocio de hoy (Caracas). Una fecha pasada deja de contar sola, sin cron. */
export function isSoldOutToday(soldOut: Date | null | undefined, now: Date = new Date()): boolean {
  return !!soldOut && soldOut.toISOString().slice(0, 10) === businessDateKey(now)
}

/** Valor para guardar sold_out_date = hoy (día de negocio de Caracas). */
export function todayDateValue(now: Date = new Date()): Date {
  return new Date(businessDateKey(now) + 'T00:00:00.000Z')
}
