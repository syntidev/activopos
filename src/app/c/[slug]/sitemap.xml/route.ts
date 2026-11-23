import { NextResponse } from 'next/server'
import { catalogSitemap, sitemapXml } from '@/lib/catalog-sitemap'
import { getCustomDomains } from '@/lib/custom-domains'
import { siteOrigin } from '@/lib/og/site-url'

export const dynamic = 'force-dynamic'

const SLUG_RE = /^[a-z0-9-]{1,60}$/

/**
 * Sitemap de un catálogo en activopos.com: /c/<slug>/sitemap.xml, con las mismas URLs canónicas (/c/<slug>/…) que declaran sus páginas.
 * Un negocio con dominio propio no se indexa por aquí (sus páginas llevan canonical al dominio): redirige a SU sitemap.
 */
export async function GET(_req: Request, { params }: { params: { slug: string } }): Promise<Response> {
  if (!SLUG_RE.test(params.slug)) return new NextResponse('No encontrado', { status: 404 })
  const own = getCustomDomains().find(d => d.slug === params.slug)
  if (own) return NextResponse.redirect(`https://${own.host}/sitemap.xml`, 308)
  const origin = siteOrigin()
  const entries = await catalogSitemap(params.slug, suffix => `${origin}/c/${params.slug}${suffix}`)
  if (entries.length === 0) return new NextResponse('No encontrado', { status: 404 })
  return new NextResponse(sitemapXml(entries), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
}
