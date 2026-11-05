import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { revalidateCatalogCache } from '@/lib/catalog'
import { logError } from '@/lib/safe-log'
import { OptionsEditError, getProductOptions, saveOptionsSchema, saveProductOptions } from '@/lib/product-options'

type RouteContext = { params: { id: string } }

/**
 * Grupos de opciones de un producto (plantilla Carta). Solo admin del negocio. El `business_id` sale de la sesión: el producto
 * se verifica por la capa de tenant antes de tocar las tablas de opciones (que cuelgan del producto, no del negocio).
 * Mismo patrón que /api/products/[id]/collections: el body es el estado FINAL (reemplazo completo, conservando los ids).
 */

const parseId = (raw: string): number | null => {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

async function authorize(productIdRaw: string): Promise<{ productId: number; businessId: number; userId: number } | NextResponse> {
  const { session, db } = await getAuthenticatedTenant()
  if (session.role !== 'admin' && session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const productId = parseId(productIdRaw)
  if (!productId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  const product = await db.product.findFirst({ where: { id: productId }, select: { id: true } }) // business_id inyectado
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  return { productId, businessId: session.businessId, userId: session.userId }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await authorize(params.id)
    if (auth instanceof NextResponse) return auth
    return NextResponse.json({ ok: true, groups: await getProductOptions(prisma, auth.productId) })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    logError('GET /api/products/[id]/options', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await authorize(params.id)
    if (auth instanceof NextResponse) return auth

    let input: z.infer<typeof saveOptionsSchema>
    try {
      input = saveOptionsSchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? 'Datos inválidos', issues: err.issues }, { status: 400 })
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const before = await prisma.productOptionGroup.count({ where: { product_id: auth.productId } })
    await prisma.$transaction(tx => saveProductOptions(tx, auth.productId, input))
    try {
      await prisma.activityLog.create({
        data: {
          business_id: auth.businessId, user_id: auth.userId, action: 'product_options_updated', model_type: 'Product', model_id: auth.productId,
          old_values: { groups: before }, new_values: { groups: input.groups.length, options: input.groups.reduce((n, g) => n + g.options.length, 0) },
        },
      })
    } catch (logErr) {
      logError('PUT /api/products/[id]/options (auditoría)', logErr)
    }
    await revalidateCatalogCache(auth.businessId)
    return NextResponse.json({ ok: true, groups: await getProductOptions(prisma, auth.productId) })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    if (e instanceof OptionsEditError) return NextResponse.json({ error: e.message }, { status: e.status })
    logError('PUT /api/products/[id]/options', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
