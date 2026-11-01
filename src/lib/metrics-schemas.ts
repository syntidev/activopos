import { z } from 'zod'
import { MAX_RANGE_DAYS, inclusiveDays } from '@/lib/metrics-calc'

// Validación de entrada de /api/metrics/* (zod v4). Contrato: .doc/CONTRATO_METRICAS.md.

// Fecha de calendario real: rechaza 2026-02-31 (Date.UTC la rodaría en silencio).
function isRealDate(key: string): boolean {
  const [y, m, d] = key.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate, 'Fecha inválida')
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
// "?category_id=" (vacío) se trata como ausente.
const optId = z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().positive().optional())

const MAX_Q_CHARS = 60
const MAX_Q_WORDS = 5

const rangeShape = { from: dateKey.optional(), to: dateKey.optional() }

function checkRange(v: { from?: string; to?: string }, ctx: z.RefinementCtx): void {
  if ((v.from === undefined) !== (v.to === undefined)) {
    ctx.addIssue({ code: 'custom', path: ['from'], message: 'from y to van juntos' })
    return
  }
  if (v.from === undefined || v.to === undefined) return
  if (v.from > v.to) ctx.addIssue({ code: 'custom', path: ['from'], message: '"from" debe ser anterior o igual a "to"' })
  else if (inclusiveDays(v.from, v.to) > MAX_RANGE_DAYS) ctx.addIssue({ code: 'custom', path: ['to'], message: `Rango máximo ${MAX_RANGE_DAYS} días` })
}

export const productsQuerySchema = z.object({
  ...rangeShape,
  category_id: optId,
  brand_id: optId,
  cashier_id: optId,
  q: z.string().trim().max(MAX_Q_CHARS).refine(s => s.split(/\s+/).filter(Boolean).length <= MAX_Q_WORDS, 'Máximo 5 palabras').optional(),
}).superRefine(checkRange)

export const groupsQuerySchema = z.object({
  ...rangeShape,
  by: z.enum(['category', 'subcategory', 'brand']),
  cashier_id: optId,
}).superRefine(checkRange)

export const exportQuerySchema = z.object({
  ...rangeShape,
  view: z.enum(['products', 'groups']),
  by: z.enum(['category', 'subcategory', 'brand']).optional(),
  category_id: optId,
  brand_id: optId,
  cashier_id: optId,
  q: z.string().trim().max(MAX_Q_CHARS).refine(s => s.split(/\s+/).filter(Boolean).length <= MAX_Q_WORDS, 'Máximo 5 palabras').optional(),
}).superRefine(checkRange).superRefine((v, ctx) => {
  if (v.view === 'groups' && !v.by) ctx.addIssue({ code: 'custom', path: ['by'], message: 'by requerido para view=groups' })
})

export const goalsQuerySchema = z.object({ period: period.optional() })

export const createGoalSchema = z.strictObject({
  scope: z.enum(['product', 'category', 'brand']),
  ref_id: z.number().int().positive(),
  period,
  metric: z.enum(['units', 'usd']),
  target: z.number().positive().max(9_999_999_999),
})

export const patchGoalSchema = z.strictObject({
  target: z.number().positive().max(9_999_999_999),
})
