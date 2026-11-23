import { NextResponse } from 'next/server'
import { getCustomDomains } from '@/lib/custom-domains'
import { siteOrigin } from '@/lib/og/site-url'

export const dynamic = 'force-dynamic'

const SLUG_RE = /^[a-z0-9-]{1,60}$/

/** robots.txt de un catálogo en activopos.com: no bloquea el catálogo y apunta a su sitemap. Con dominio propio redirige al del dominio. */
export async function GET(_req: Request, { params }: { params: { slug: string } }): Promise<Response> {
  if (!SLUG_RE.test(params.slug)) return new NextResponse('No encontrado', { status: 404 })
  const own = getCustomDomains().find(d => d.slug === params.slug)
  if (own) return NextResponse.redirect(`https://${own.host}/robots.txt`, 308)
  const body = ['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${siteOrigin()}/c/${params.slug}/sitemap.xml`, ''].join('\n')
  return new NextResponse(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
}
