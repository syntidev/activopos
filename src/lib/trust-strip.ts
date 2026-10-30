import { z } from 'zod'

/**
 * Franja de confianza de la home premium (Envío / Garantía / Atención): business.settings.trust_strip = 3 items
 * {title, desc}. Sin valor guardado (o inválido) se usan EXACTAMENTE los textos de siempre. Los íconos son fijos
 * por posición (camión, escudo, mensaje) y viven en CatalogoGrid.
 */
export const TRUST_TITLE_MAX = 40
export const TRUST_DESC_MAX = 90
export const TRUST_ITEMS = 3

export interface TrustItem { title: string; desc: string }

export const DEFAULT_TRUST_STRIP: readonly TrustItem[] = [
  { title: 'Envío en Margarita',         desc: 'Coordinamos entrega en toda la isla.' },
  { title: 'Garantía de marca oficial',  desc: 'Distribuidor autorizado, producto original.' },
  { title: 'Atención directa',           desc: 'Escríbenos por WhatsApp, respondemos rápido.' },
]

const item = z.object({
  title: z.string().trim().min(1, 'El título no puede estar vacío').max(TRUST_TITLE_MAX, `El título admite máximo ${TRUST_TITLE_MAX} caracteres`),
  desc:  z.string().trim().min(1, 'La descripción no puede estar vacía').max(TRUST_DESC_MAX, `La descripción admite máximo ${TRUST_DESC_MAX} caracteres`),
})

/** Validación estricta (admin): exactamente 3 items. */
export const trustStripInputSchema = z.array(item).length(TRUST_ITEMS, `La franja lleva exactamente ${TRUST_ITEMS} items`)

/** Lectura tolerante de settings: ausente o inválido → los textos de siempre. */
export function readTrustStrip(settings: unknown): TrustItem[] {
  const raw = (settings as Record<string, unknown> | null)?.trust_strip
  const r = trustStripInputSchema.safeParse(raw)
  return r.success ? r.data : DEFAULT_TRUST_STRIP.map(i => ({ ...i }))
}
