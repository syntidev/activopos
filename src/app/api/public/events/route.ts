import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getClientIp, pulsoEventsLimiter } from '@/lib/rate-limit'
import { logError } from '@/lib/safe-log'
import { brandSlug } from '@/lib/vitrina'
import { isBotUserAgent, pulsoRequestContext } from '@/lib/pulso-ua'
import { PulsoBatchSchema, cleanAttribution } from '@/lib/pulso-events'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 16 * 1024

// Texto de búsqueda que parece teléfono, cédula o email: el evento se descarta (no se guarda dato personal).
const SENSITIVE_QUERY_RE = /\d{6,}|@|\d[\d\s.-]{7,}/

// /catalogo-premium/<slug>/marca/<marcaSlug>
const BRAND_PATH_RE = /^\/catalogo-premium\/[^/]+\/marca\/([^/?#]+)/

function brandSlugFromPath(path: string): string | null {
  const m = BRAND_PATH_RE.exec(path)
  if (!m) return null
  try { return decodeURIComponent(m[1]) } catch { return m[1] }
}

// Analítica propia del catálogo (ver .doc/CONTRATO_PULSO.md §3). Público: el negocio sale del slug, nunca del body.
export async function POST(req: NextRequest): Promise<Response> {
  // Do-Not-Track / Global Privacy Control: el navegador pidió no ser medido. El tracker ya lo respeta;
  // acá se respeta también para clientes que no pasen por él.
  if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1') return new Response(null, { status: 204 })

  // Tope de cuerpo ANTES de parsear: un lote legítimo (≤ 20 eventos) pesa ~4 KB.
  if (Number(req.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Cuerpo demasiado grande' }, { status: 413 })
  }
  let raw: unknown
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Cuerpo demasiado grande' }, { status: 413 })
    raw = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = PulsoBatchSchema.safeParse(raw)
  if (!parsed.success) {
    // Nunca eco del input: solo cuántos campos fallaron.
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
  const { slug, session_id, attribution, events } = parsed.data

  // El path debe pertenecer a ESTE catálogo y venir sin query string ni fragmento (podrían traer datos personales).
  const base = `/catalogo-premium/${slug}`
  if (events.some(e => !(e.path === base || e.path.startsWith(`${base}/`)) || /[?#]/.test(e.path))) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  try {
    await pulsoEventsLimiter.consume(`${getClientIp(req)}:${slug}`)
  } catch {
    return NextResponse.json({ error: 'Demasiados eventos' }, { status: 429 })
  }

  // Bots: se responde igual que un éxito para que no reintenten, sin tocar la DB.
  if (isBotUserAgent(req.headers.get('user-agent'))) return new Response(null, { status: 204 })

  try {
    const business = await prisma.business.findFirst({
      where:  { catalog_slug: slug, catalog_active: true, active: true },
      select: { id: true },
    })
    if (!business) return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 })

    // Un solo viaje para validar todos los product_id contra el negocio y traer su marca.
    const productIds = Array.from(new Set(events.flatMap(e => (e.product_id !== undefined ? [e.product_id] : []))))
    const products = productIds.length
      ? await prisma.product.findMany({
          where:  { id: { in: productIds }, business_id: business.id },
          select: { id: true, brand_id: true },
        })
      : []
    const brandByProduct = new Map(products.map(p => [p.id, p.brand_id]))

    // Marcas visibles: solo se consultan si alguna ruta es /marca/<slug>.
    const needsBrands = events.some(e => brandSlugFromPath(e.path) !== null)
    const brandIdBySlug = new Map<string, number>()
    if (needsBrands) {
      const brands = await prisma.brand.findMany({
        where:  { business_id: business.id, visible: true },
        select: { id: true, name: true },
      })
      for (const b of brands) brandIdBySlug.set(brandSlug(b.name), b.id)
    }

    const ctx = pulsoRequestContext(req)
    const attr = cleanAttribution(attribution)

    const data: Prisma.CatalogEventCreateManyInput[] = []
    for (const e of events) {
      // product_id ajeno: se descarta el evento completo.
      if (e.product_id !== undefined && !brandByProduct.has(e.product_id)) continue
      // Búsqueda con pinta de dato personal (teléfono, cédula, email): no se guarda.
      if (e.type === 'search' && e.query && SENSITIVE_QUERY_RE.test(e.query)) continue
      const routeBrand = brandSlugFromPath(e.path)
      const brandId = (e.product_id !== undefined ? brandByProduct.get(e.product_id) : null)
        ?? (routeBrand ? brandIdBySlug.get(routeBrand) : null)
        ?? null
      data.push({
        business_id:   business.id,
        session_id,
        type:          e.type,
        path:          e.path,
        product_id:    e.product_id ?? null,
        brand_id:      brandId,
        deporte:       e.deporte ?? null,
        query:         e.query ?? null,
        results_count: e.results_count ?? null,
        ...attr,
        device:        ctx.device,
        os:            ctx.os,
        browser:       ctx.browser,
        country:       ctx.country,
        city:          ctx.city,
      })
    }

    if (data.length > 0) await prisma.catalogEvent.createMany({ data })
    return new Response(null, { status: 204 })
  } catch (err) {
    logError('pulso events error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
