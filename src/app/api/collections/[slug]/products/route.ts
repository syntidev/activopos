import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

type RouteContext = { params: { slug: string } }

function parseImages(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

// Endpoint autenticado (dashboard/preview) — mismo namespace que GET/POST
// /api/collections, business_id de session. El catálogo público anónimo NO
// pasa por acá: como con Landing Sections Fase 1, una page.tsx server
// component sin sesión consulta prisma directo para el render cara-al-cliente.
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { db } = await getAuthenticatedTenant()

    const collection = await db.collection.findFirst({
      where: { slug: params.slug }, // business_id inyectado por el tenant layer
    })
    if (!collection) return NextResponse.json({ error: 'Colección no encontrada' }, { status: 404 })

    const links = await db.productCollection.findMany({
      where:   { collection_id: collection.id },
      include: {
        product: {
          select: {
            id: true, name: true, images: true,
            price_per_unit_usd: true, price_per_kg_usd: true,
            category: { select: { name: true } },
            active: true, show_in_catalog: true,
          },
        },
      },
    })

    const products = links
      .map(l => l.product)
      .filter(p => p.active)
      .map(p => ({
        id:              p.id,
        name:            p.name,
        image:           parseImages(p.images)[0] ?? null,
        price_usd:       Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0),
        category_name:   p.category?.name ?? null,
        show_in_catalog: p.show_in_catalog,
      }))

    return NextResponse.json({ ok: true, collection, products })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
