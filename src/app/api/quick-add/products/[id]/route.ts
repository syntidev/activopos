import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { revalidateCatalogCache } from '@/lib/catalog'
import { createStockAdjustment, getNetStock } from '@/lib/stock-adjust'
import { productResult, requireQuickAdd, toMoney } from '@/lib/quick-add'

const MAX_DELTA = 100_000
const MAX_PRICE = 1_000_000

const patchSchema = z.object({
  quantity_delta: z.number().int().min(-MAX_DELTA).max(MAX_DELTA).refine(n => n !== 0).optional(),
  price_usd:      z.number().min(0.01).max(MAX_PRICE).optional(),
  wholesale_usd:  z.number().min(0).max(MAX_PRICE).nullable().optional(),
}).strict()

/**
 * "Sumar cantidad" a un producto existente y corrección de lo cargado en la sesión.
 * La cantidad nunca se edita sobre un asiento viejo: se agrega un asiento 'adjustment' con la diferencia.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await requireQuickAdd()
  if (session instanceof NextResponse) return session
  const businessId = session.businessId

  const id = Number((await params).id)
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!Number.isInteger(id) || id <= 0 || !parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
  const { quantity_delta: delta, price_usd: price, wholesale_usd: wholesale } = parsed.data

  const product = await prisma.product.findFirst({
    where: { id, business_id: businessId, has_variants: false },
    select: { id: true },
  })
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

  if (delta !== undefined && (await getNetStock(prisma, businessId, id)) + delta < 0) {
    return NextResponse.json({ error: 'El stock no puede quedar negativo' }, { status: 422 })
  }

  try {
    await applyPatch(businessId, session.userId, id, { delta, price, wholesale })
  } catch (err) {
    console.error('quick-add patch error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }

  try { await revalidateCatalogCache(businessId) }
  catch (err) { console.error('[quick-add] revalidateCatalogCache falló', { business_id: businessId, err }) }

  return NextResponse.json({ product: await productResult(businessId, id) })
}

interface PatchChange {
  delta: number | undefined
  price: number | undefined
  wholesale: number | null | undefined
}

async function applyPatch(businessId: number, userId: number, id: number, { delta, price, wholesale }: PatchChange): Promise<void> {
  await prisma.$transaction(async tx => {
    if (price !== undefined || wholesale !== undefined) {
      await tx.product.update({
        where: { id },
        data: {
          ...(price !== undefined ? { price_per_unit_usd: toMoney(price) } : {}),
          ...(wholesale !== undefined ? { wholesale_price_usd: wholesale === null ? null : toMoney(wholesale) } : {}),
        },
      })
    }
    if (delta !== undefined) {
      await createStockAdjustment(tx, { businessId, productId: id, userId, quantity: delta, notes: 'Alta rápida' })
    }
  })
}
