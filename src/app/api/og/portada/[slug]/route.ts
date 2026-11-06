import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCatalogLive } from '@/lib/catalog'
import { coverFill, loadImageBytes, logoPng } from '@/lib/og/images'
import { brandAccent, DARK, jpegResponse, LIGHT, renderCoverCard } from '@/lib/og/image'
import { OG_HEIGHT, OG_WIDTH } from '@/lib/og/metadata'

export const runtime = 'nodejs'

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,98}$/

/** Tarjeta 1200×630 de la portada de un catálogo: imagen de portada (si hay) o color de marca, con logo y nombre del negocio. */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }): Promise<Response> {
  if (!SLUG_RE.test(params.slug)) return new NextResponse('No encontrado', { status: 404 })

  const business = await prisma.business.findFirst({
    where:  { catalog_slug: params.slug, catalog_active: true, active: true },
    select: {
      id: true, name: true, theme_color: true, logo_path: true, catalog_template: true, catalog_title: true, catalog_desc: true,
      catalog_cover_path: true, catalog_plan: true, subscription_active: true, subscription_expires_at: true,
    },
  })
  if (!business || !isCatalogLive(business)) return new NextResponse('No encontrado', { status: 404 })

  const base = business.catalog_template === 'carta' ? DARK : LIGHT
  const palette = { ...base, accent: brandAccent(business.theme_color, base.accent) }

  const [coverBytes, logoBytes] = await Promise.all([
    business.catalog_cover_path ? loadImageBytes(business.catalog_cover_path, business.id) : Promise.resolve(null),
    business.logo_path ? loadImageBytes(business.logo_path, business.id) : Promise.resolve(null),
  ])
  const [background, logo] = await Promise.all([
    coverBytes ? coverFill(coverBytes, OG_WIDTH, OG_HEIGHT) : Promise.resolve(null),
    logoBytes ? logoPng(logoBytes, 420, 170) : Promise.resolve(null),
  ])

  const jpeg = await renderCoverCard({
    palette, businessName: business.catalog_title?.trim() || business.name,
    tagline: business.catalog_desc?.trim() || null, logo, background,
  })
  return jpegResponse(jpeg)
}
