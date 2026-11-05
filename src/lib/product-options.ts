import { z } from 'zod'
import type { Prisma, PrismaClient } from '@prisma/client'
import type { ProductOptionGroupDTO } from '@/types/product-options'

type Db = Prisma.TransactionClient | PrismaClient

export const MAX_GROUPS = 20
export const MAX_OPTIONS = 30

/** Error de validación de negocio (422). */
export class OptionsEditError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

const name = z.string().trim().min(1, 'El nombre es obligatorio').max(60, 'Máximo 60 caracteres')

const optionSchema = z.strictObject({
  id:              z.number().int().positive().optional(),
  name,
  price_extra_usd: z.number().min(0, 'El extra no puede ser negativo').max(9999.99),
  is_active:       z.boolean().default(true),
})

const groupSchema = z.strictObject({
  id:         z.number().int().positive().optional(),
  name,
  required:   z.boolean(),
  multiple:   z.boolean(),
  max_select: z.number().int().min(1).max(MAX_OPTIONS).nullable(),
  is_active:  z.boolean().default(true),
  options:    z.array(optionSchema).min(1, 'Cada grupo necesita al menos una opción').max(MAX_OPTIONS),
}).superRefine((g, ctx) => {
  const names = g.options.map(o => o.name.toLowerCase())
  if (new Set(names).size !== names.length) ctx.addIssue({ code: 'custom', message: `"${g.name}": hay opciones con el mismo nombre`, path: ['options'] })
  if (!g.multiple && g.max_select !== null) ctx.addIssue({ code: 'custom', message: `"${g.name}": el tope solo aplica a elección múltiple`, path: ['max_select'] })
  if (g.multiple && g.max_select !== null && g.max_select > g.options.length) ctx.addIssue({ code: 'custom', message: `"${g.name}": el tope no puede superar las ${g.options.length} opciones`, path: ['max_select'] })
})

/** PUT /api/products/[id]/options: el estado FINAL de los grupos del producto (reemplazo completo, en orden). */
export const saveOptionsSchema = z.strictObject({
  groups: z.array(groupSchema).max(MAX_GROUPS),
}).superRefine((d, ctx) => {
  const names = d.groups.map(g => g.name.toLowerCase())
  if (new Set(names).size !== names.length) ctx.addIssue({ code: 'custom', message: 'Hay grupos con el mismo nombre', path: ['groups'] })
})
export type SaveOptionsInput = z.infer<typeof saveOptionsSchema>

const round2 = (n: number): number => Math.round(n * 100) / 100

export async function getProductOptions(db: Db, productId: number): Promise<ProductOptionGroupDTO[]> {
  const groups = await db.productOptionGroup.findMany({
    where:   { product_id: productId },
    include: { options: { orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] } },
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
  })
  return groups.map(g => ({
    id: g.id, name: g.name, required: g.required, multiple: g.multiple, max_select: g.max_select, is_active: g.is_active,
    options: g.options.map(o => ({ id: o.id, name: o.name, price_extra_usd: Number(o.price_extra_usd), is_active: o.is_active })),
  }))
}

/**
 * Aplica el estado final de los grupos del producto dentro de UNA transacción. Lo que ya existía conserva su id (los carritos y
 * pedidos que lo referencian no se rompen); lo que ya no viene se borra; el orden del arreglo fija sort_order.
 * `productId` debe haberse verificado ya como del negocio de la sesión. Un id de grupo/opción ajeno al producto se rechaza (422).
 */
export async function saveProductOptions(tx: Prisma.TransactionClient, productId: number, input: SaveOptionsInput): Promise<void> {
  const current = await tx.productOptionGroup.findMany({ where: { product_id: productId }, include: { options: { select: { id: true } } } })
  const groupIds = new Map(current.map(g => [g.id, new Set(g.options.map(o => o.id))]))

  for (const g of input.groups) {
    if (g.id !== undefined && !groupIds.has(g.id)) throw new OptionsEditError(422, 'Un grupo no pertenece a este producto.')
    for (const o of g.options) {
      if (o.id !== undefined && (g.id === undefined || !groupIds.get(g.id)?.has(o.id))) throw new OptionsEditError(422, 'Una opción no pertenece a su grupo.')
    }
  }

  const keepGroups = new Set(input.groups.flatMap(g => (g.id !== undefined ? [g.id] : [])))
  const dropGroups = current.filter(g => !keepGroups.has(g.id)).map(g => g.id)
  if (dropGroups.length > 0) await tx.productOptionGroup.deleteMany({ where: { id: { in: dropGroups }, product_id: productId } }) // las opciones caen en cascada

  for (let gi = 0; gi < input.groups.length; gi++) {
    const g = input.groups[gi]
    const data = { name: g.name, required: g.required, multiple: g.multiple, max_select: g.multiple ? g.max_select : null, is_active: g.is_active, sort_order: gi }
    const groupId = g.id !== undefined
      ? (await tx.productOptionGroup.update({ where: { id: g.id }, data })).id
      : (await tx.productOptionGroup.create({ data: { ...data, product_id: productId } })).id

    const keepOpts = new Set(g.options.flatMap(o => (o.id !== undefined ? [o.id] : [])))
    const existing = g.id !== undefined ? Array.from(groupIds.get(g.id) ?? []) : []
    const dropOpts = existing.filter(id => !keepOpts.has(id))
    if (dropOpts.length > 0) await tx.productOption.deleteMany({ where: { id: { in: dropOpts }, group_id: groupId } })

    for (let oi = 0; oi < g.options.length; oi++) {
      const o = g.options[oi]
      const od = { name: o.name, price_extra_usd: round2(o.price_extra_usd), is_active: o.is_active, sort_order: oi }
      if (o.id !== undefined) await tx.productOption.update({ where: { id: o.id }, data: od })
      else await tx.productOption.create({ data: { ...od, group_id: groupId } })
    }
  }
}
