import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { normalizeTemplate, templateBasePath, type PlantillaKey } from '@/lib/plantillas'

/**
 * UNA sola URL pública por negocio: /c/[slug] (y /c/[slug]/productos, /c/[slug]/p/12, …). Resuelve la plantilla desde la DB y
 * redirige (307, temporal) a la ruta de esa plantilla: cambiar de plantilla NO cambia el enlace que se le dio al cliente.
 * Las rutas viejas (/catalogo, /catalogo-premium, /catalogo-carta) siguen funcionando tal cual.
 */

const SLUG_RE = /^[a-z0-9-]{1,60}$/

let cartaExists: boolean | null = null
/** La plantilla Carta la construye otra rama: mientras su ruta no exista en el código, un negocio carta se sirve con la genérica
 *  (la premium rechaza todo negocio que no sea premium). Al llegar /catalogo-carta, el mismo enlace pasa a servirla solo. */
function cartaRouteExists(): boolean {
  if (cartaExists === null) cartaExists = fs.existsSync(path.join(process.cwd(), 'src', 'app', 'catalogo-carta'))
  return cartaExists
}

function effectiveTemplate(template: PlantillaKey): PlantillaKey {
  return template === 'carta' && !cartaRouteExists() ? 'generic' : template
}

export async function GET(req: NextRequest, { params }: { params: { slug: string; rest?: string[] } }) {
  if (!SLUG_RE.test(params.slug)) notFound()
  const business = await prisma.business.findFirst({
    where:  { catalog_slug: params.slug, active: true },
    select: { catalog_template: true },
  })
  if (!business) notFound()

  const base = templateBasePath(effectiveTemplate(normalizeTemplate(business.catalog_template)))
  // Ruta relativa y construida solo con piezas validadas/codificadas: nunca redirige fuera del sitio.
  // Next entrega los segmentos ya decodificados: "." y ".." se rechazan (el navegador los normalizaría hacia otras rutas).
  const segments = params.rest ?? []
  if (segments.length > 6 || segments.some(s => s === '.' || s === '..' || s === '')) notFound()
  const rest = segments.map(encodeURIComponent).join('/')
  const location = `${base}/${params.slug}${rest ? `/${rest}` : ''}${req.nextUrl.search}`
  return new NextResponse(null, { status: 307, headers: { Location: location, 'Cache-Control': 'no-store' } })
}
