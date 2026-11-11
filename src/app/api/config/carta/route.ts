import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidateCatalogCache } from '@/lib/catalog'
import { CARTA_ACCENTS, CARTA_PRESETS, CARTA_STYLES, DAY_KEYS, isCartaPaused, readCartaHours, readCartaSettings, readCoverMeta } from '@/lib/carta/settings'
import { logError } from '@/lib/safe-log'
import { imagePath } from '@/lib/landing-sections'
import { SHOW_ON } from '@/lib/slide-media'

/**
 * Configuración de la Carta (preset, acento, estilo, horario y pausa). Solo admin; business_id SIEMPRE de la sesión.
 * Todo vive en business.settings (JSON): carta_preset, carta_accent, carta_style, carta_hours, carta_paused. Sin cambio de esquema.
 */

async function requireAdmin(): Promise<{ businessId: number } | NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  return { businessId: session.businessId }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const span = z.tuple([z.string().regex(TIME), z.string().regex(TIME)]).refine(([a, b]) => a < b, { message: 'La hora de cierre debe ser posterior a la de apertura' })
const hoursSchema = z.strictObject(Object.fromEntries(DAY_KEYS.map(d => [d, z.array(span).max(4).optional()])) as Record<(typeof DAY_KEYS)[number], z.ZodOptional<z.ZodArray<typeof span>>>)

const coverMeta = z.strictObject({
  mobile_path: imagePath().nullable().optional(),
  focus_x:     z.number().min(0).max(100),
  focus_y:     z.number().min(0).max(100),
  show_on:     z.enum(SHOW_ON),
})

const patchSchema = z.strictObject({
  carta_preset: z.enum(CARTA_PRESETS).optional(),
  carta_accent: z.enum(CARTA_ACCENTS).nullable().optional(),
  carta_style:  z.enum(CARTA_STYLES).optional(),
  carta_hours:  hoursSchema.optional(),
  carta_paused: z.boolean().optional(),
  // Portadas 1..3: imagen móvil, punto de enfoque (%) y dónde mostrar. Reemplaza el bloque completo.
  carta_cover_meta: z.strictObject({ '1': coverMeta.optional(), '2': coverMeta.optional(), '3': coverMeta.optional() }).optional(),
}).refine(d => Object.values(d).some(v => v !== undefined), { message: 'Nada que guardar' })

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const business = await prisma.business.findUnique({ where: { id: auth.businessId }, select: { settings: true, catalog_template: true } })
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  return NextResponse.json({
    ok: true,
    config: { ...readCartaSettings(business.settings), hours: readCartaHours(business.settings), paused: isCartaPaused(business.settings), cover_meta: readCoverMeta(business.settings) },
    presets: CARTA_PRESETS, accents: CARTA_ACCENTS, styles: CARTA_STYLES,
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  try {
    const parsed = patchSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
    const business = await prisma.business.findUnique({ where: { id: auth.businessId }, select: { settings: true } })
    if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const next: Record<string, unknown> = { ...((business.settings ?? {}) as Record<string, unknown>) }
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value === undefined) continue
      if (value === null) delete next[key]
      else next[key] = value
    }
    await prisma.business.update({ where: { id: auth.businessId }, data: { settings: next as object } })
    await revalidateCatalogCache(auth.businessId)
    return NextResponse.json({ ok: true, config: { ...readCartaSettings(next), hours: readCartaHours(next), paused: isCartaPaused(next) } })
  } catch (e) {
    logError('config/carta PATCH', e)
    return NextResponse.json({ error: 'No se pudo guardar la configuración de la Carta.' }, { status: 500 })
  }
}
