import { z } from 'zod'
import { PULSO_CLIENT_EVENT_TYPES, PULSO_MAX_BATCH } from '@/types/pulso'
import type { PulsoAttribution } from '@/types/pulso'

const PATH_PREFIX = '/catalogo-premium/'
const MAX_RESULTS_COUNT = 100000

const attributionShape = {
  utm_source:    z.string().max(80).optional(),
  utm_medium:    z.string().max(80).optional(),
  utm_campaign:  z.string().max(80).optional(),
  utm_content:   z.string().max(80).optional(),
  utm_term:      z.string().max(100).optional(),
  referrer_host: z.string().max(120).optional(),
}

const AttributionSchema = z.strictObject(attributionShape)

const EventSchema = z.strictObject({
  type:          z.enum(PULSO_CLIENT_EVENT_TYPES),   // order_created queda fuera: es solo del servidor
  path:          z.string().min(1).max(255).startsWith(PATH_PREFIX),
  product_id:    z.number().int().positive().optional(),
  deporte:       z.string().max(40).optional(),
  query:         z.string().max(100).optional(),
  results_count: z.number().int().min(0).max(MAX_RESULTS_COUNT).optional(),
}).superRefine((e, ctx) => {
  const need = (ok: boolean, field: string): void => {
    if (!ok) ctx.addIssue({ code: 'custom', path: [field], message: `${field} requerido para ${e.type}` })
  }
  if (e.type === 'product_view' || e.type === 'add_to_cart') need(e.product_id !== undefined, 'product_id')
  if (e.type === 'search') {
    need(!!e.query, 'query')
    need(e.results_count !== undefined, 'results_count')
  }
  if (e.type === 'deporte_select') need(!!e.deporte, 'deporte')
  if (e.type === 'currency_switch') need(e.query === 'bs' || e.query === 'divisa', 'query')
})

export const PulsoBatchSchema = z.strictObject({
  slug:        z.string().regex(/^[a-z0-9-]{3,50}$/),
  session_id:  z.uuid(),
  attribution: AttributionSchema.optional(),
  events:      z.array(EventSchema).min(1).max(PULSO_MAX_BATCH),
})

/** Bloque `pulso` del pedido público: sesión + atribución. */
export const PulsoOrderSchema = z.strictObject({
  session_id: z.uuid(),
  ...attributionShape,
})

export type PulsoBatch = z.infer<typeof PulsoBatchSchema>
export type PulsoOrder = z.infer<typeof PulsoOrderSchema>

function clean(v: string | undefined, max: number, lower: boolean): string | undefined {
  const t = v?.trim()
  if (!t) return undefined
  return (lower ? t.toLowerCase() : t).slice(0, max)
}

/** Normaliza: trim, vacíos → undefined, minúsculas en utm_source/medium, recorta largos. */
export function cleanAttribution(a: Partial<PulsoAttribution> | undefined): PulsoAttribution {
  return {
    utm_source:    clean(a?.utm_source, 80, true),
    utm_medium:    clean(a?.utm_medium, 80, true),
    utm_campaign:  clean(a?.utm_campaign, 80, false),
    utm_content:   clean(a?.utm_content, 80, false),
    utm_term:      clean(a?.utm_term, 100, false),
    referrer_host: clean(a?.referrer_host, 120, false),
  }
}
