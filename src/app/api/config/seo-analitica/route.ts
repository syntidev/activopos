import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminConCatalogo } from '@/lib/catalog-admin-auth'
import { revalidateCatalogCache } from '@/lib/catalog'
import { GA4_RE, GSC_RE, SEO_DESC_MAX, SEO_KEYS, SEO_TITLE_MAX, readSeo } from '@/lib/seo'

/**
 * SEO y Analítica del negocio. Solo admin y plan con catálogo; business_id SIEMPRE de la sesión.
 * Todo vive en business.settings (JSON), sin cambio de esquema. ga4_id y gsc_verification se validan aquí con regex:
 * el ID de GA4 se interpola en un <script>, así que un valor libre sería una inyección.
 */

// "" = borrar el campo (null). Cualquier otra cosa se valida con su regla.
const blank = (v: unknown): unknown => (typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v)

const patchSchema = z.strictObject({
  seo_title:        z.preprocess(blank, z.string().max(SEO_TITLE_MAX, `Máximo ${SEO_TITLE_MAX} caracteres`).nullable()).optional(),
  seo_description:  z.preprocess(blank, z.string().max(SEO_DESC_MAX, `Máximo ${SEO_DESC_MAX} caracteres`).nullable()).optional(),
  ga4_id:           z.preprocess(blank, z.string().regex(GA4_RE, 'ID de GA4 inválido: debe verse como G-XXXXXXXXXX').nullable()).optional(),
  gsc_verification: z.preprocess(blank, z.string().regex(GSC_RE, 'Código de verificación inválido: solo letras, números, guion y guion bajo (20 a 100)').nullable()).optional(),
}).refine(d => Object.values(d).some(v => v !== undefined), { message: 'Nada que guardar' })

export async function GET(): Promise<NextResponse> {
  const auth = await requireAdminConCatalogo()
  if (auth instanceof NextResponse) return auth
  const row = await prisma.business.findUnique({ where: { id: auth.businessId }, select: { settings: true } })
  return NextResponse.json({ ok: true, seo: readSeo(row?.settings) })
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminConCatalogo()
  if (auth instanceof NextResponse) return auth
  try {
    const parsed = patchSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return NextResponse.json({ error: first?.message ?? 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
    }
    const row = await prisma.business.findUnique({ where: { id: auth.businessId }, select: { settings: true } })
    const next: Record<string, unknown> = { ...((row?.settings ?? {}) as Record<string, unknown>) }
    for (const key of SEO_KEYS) {
      const value = parsed.data[key]
      if (value === undefined) continue
      if (value === null) delete next[key]
      else next[key] = value
    }
    await prisma.business.update({ where: { id: auth.businessId }, data: { settings: next as object } })
    await revalidateCatalogCache(auth.businessId)
    return NextResponse.json({ ok: true, seo: readSeo(next) })
  } catch (err) {
    console.error('config/seo-analitica PATCH', err)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
