import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const bodySchema = z.object({
  collection_ids: z.array(z.number().int().positive()).max(50),
}).strict()

type RouteContext = { params: { id: string } }

const parseId = (raw: string) => { const n = parseInt(raw); return isNaN(n) ? null : n }

// Reemplazo completo: el body es el set final de colecciones del producto,
// no un delta — más simple para un selector multi-choice en el form (manda
// el estado completo cada vez, igual que category_id/tags en otros forms).
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const productId = parseId(params.id)
    if (!productId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      }
      throw err
    }

    const product = await db.product.findFirst({
      where:  { id: productId }, // business_id inyectado por el tenant layer
      select: { id: true },
    })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    const uniqueIds = Array.from(new Set(data.collection_ids))
    if (uniqueIds.length > 0) {
      const owned = await db.collection.findMany({
        where:  { id: { in: uniqueIds } }, // business_id inyectado por el tenant layer
        select: { id: true },
      })
      if (owned.length !== uniqueIds.length) {
        return NextResponse.json({ error: 'Una o más colecciones no existen en este negocio' }, { status: 400 })
      }
    }

    await db.$transaction([
      db.productCollection.deleteMany({ where: { product_id: productId } }),
      ...(uniqueIds.length
        ? [db.productCollection.createMany({
            data: uniqueIds.map(collection_id => ({ product_id: productId, collection_id })),
          })]
        : []),
    ])

    const collections = await db.productCollection.findMany({
      where:   { product_id: productId },
      include: { collection: true },
    })

    return NextResponse.json({ ok: true, collections: collections.map(c => c.collection) })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
