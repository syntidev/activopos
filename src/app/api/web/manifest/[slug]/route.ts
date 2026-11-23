import { NextResponse } from 'next/server'
import { currentCustomDomain } from '@/lib/catalog-links-server'
import { accentOf, faviconFile, loadIdentityBusiness, readBase } from '@/lib/web-identity'

export const runtime = 'nodejs'

/** Manifest PWA del catálogo de un negocio: su nombre y sus íconos. Sin favicon propio no hay manifest (queda el de ActivoPOS). */
export async function GET(_req: Request, { params }: { params: { slug: string } }): Promise<Response> {
  const b = await loadIdentityBusiness(params.slug)
  const base = b ? readBase(b.settings, b.id, 'favicon') : null
  if (!b || !base) return new NextResponse('No encontrado', { status: 404 })
  // En el dominio propio del tenant la portada es "/", en activopos.com es /c/<slug>.
  const own = currentCustomDomain()?.slug === params.slug
  const start = own ? '/' : `/c/${params.slug}`
  const accent = accentOf(b)
  const body = {
    name: b.name,
    short_name: b.name.slice(0, 12),
    start_url: start,
    scope: start,
    display: 'standalone',
    background_color: '#ffffff',
    ...(accent ? { theme_color: accent } : {}),
    icons: ([192, 512] as const).map(s => ({ src: faviconFile(base, s), sizes: `${s}x${s}`, type: 'image/png', purpose: 'any' })),
  }
  return new NextResponse(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=300' },
  })
}
