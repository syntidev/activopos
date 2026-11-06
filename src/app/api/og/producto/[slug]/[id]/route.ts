import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { divisaPriceOf } from '@/lib/catalog-divisa'
import { readCobroEffective } from '@/lib/cobro-precios'
import { isCatalogLive, CATALOG_WHERE_FILTER } from '@/lib/catalog'
import { firstReadable, loadImageBytes, logoPng, photoSquare } from '@/lib/og/images'
import { brandAccent, DARK, jpegResponse, LIGHT, renderProductCard } from '@/lib/og/image'
import { OG_HEIGHT } from '@/lib/og/metadata'

export const runtime = 'nodejs'

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,98}$/

function parseImages(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []
  } catch { return [] }
}

const fmtUsd = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtBs = (n: number): string => `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Tarjeta 1200×630 para compartir una ficha (WhatsApp/Facebook). Mismo scope que la página: negocio por catalog_slug vivo,
 * producto del MISMO business_id, activo y visible en catálogo. Funciona para las tres plantillas (premium, carta, genérica).
 */
export async function GET(_req: NextRequest, { params }: { params: { slug: string; id: string } }): Promise<Response> {
  const productId = Number(params.id)
  if (!SLUG_RE.test(params.slug) || !Number.isInteger(productId) || productId <= 0) return new NextResponse('No encontrado', { status: 404 })

  const business = await prisma.business.findFirst({
    where:  { catalog_slug: params.slug, catalog_active: true, active: true },
    select: {
      id: true, name: true, theme_color: true, logo_path: true, catalog_template: true, settings: true,
      catalog_plan: true, subscription_active: true, subscription_expires_at: true,
    },
  })
  if (!business || !isCatalogLive(business)) return new NextResponse('No encontrado', { status: 404 })

  const product = await prisma.product.findFirst({
    where:  { id: productId, business_id: business.id, active: true, ...CATALOG_WHERE_FILTER },
    select: {
      name: true, images: true, catalog_visibility: true,
      price_per_unit_usd: true, price_per_kg_usd: true, wholesale_price_usd: true, wholesale_price_per_kg_usd: true,
    },
  })
  if (!product) return new NextResponse('No encontrado', { status: 404 })

  const isCarta = business.catalog_template === 'carta'
  const base = isCarta ? DARK : LIGHT
  const palette = { ...base, accent: isCarta ? base.accent : brandAccent(business.theme_color, base.accent) }

  // Regla única de precio: principal = Divisa (solo premium con Divisa activa) o precio completo; Bs = completo × tasa activa.
  const full = Number((product.price_per_unit_usd ?? product.price_per_kg_usd)?.toString() ?? 0)
  const divisa = business.catalog_template === 'premium' && readCobroEffective(business.settings).divisaActive ? divisaPriceOf(product) : null
  const main = divisa ?? full
  const consult = product.catalog_visibility === 'on_request' || !(main > 0)
  const { rate } = consult ? { rate: 0 } : await getActiveRate(business.id)

  const [photoBytes, logoBytes] = await Promise.all([
    firstReadable(parseImages(product.images), business.id),
    business.logo_path ? loadImageBytes(business.logo_path, business.id) : Promise.resolve(null),
  ])
  const [photo, logo] = await Promise.all([
    photoBytes ? photoSquare(photoBytes, OG_HEIGHT, palette.bg) : Promise.resolve(null),
    logoBytes ? logoPng(logoBytes, 360, 90) : Promise.resolve(null),
  ])

  const jpeg = await renderProductCard({
    palette, name: product.name, businessName: business.name, photo, logo, consult,
    priceUsd: consult ? null : fmtUsd(main),
    priceBs:  consult || !(rate > 0) ? null : fmtBs(full * rate),
  })
  return jpegResponse(jpeg)
}
