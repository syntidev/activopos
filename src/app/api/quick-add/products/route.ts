import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { revalidateCatalogCache } from '@/lib/catalog'
import { checkPlanLimit, planDenied } from '@/lib/plan-guard'
import { createSimpleProduct } from '@/lib/product-create'
import { cleanSubcategory } from '@/lib/subcategory'
import { CODE_RE, findByBarcode, productResult, requireQuickAdd, toMoney } from '@/lib/quick-add'

const MAX_QUANTITY = 100_000
const MAX_PRICE = 1_000_000

const createSchema = z.object({
  code:          z.string().trim().regex(CODE_RE),
  name:          z.string().trim().min(1).max(120),
  quantity:      z.number().int().min(1).max(MAX_QUANTITY),
  category_id:   z.number().int().positive(),
  subcategory:   z.string().max(60).nullish().transform(v => (v ? cleanSubcategory(v) || null : null)),
  price_usd:     z.number().min(0.01).max(MAX_PRICE),
  wholesale_usd: z.number().min(0).max(MAX_PRICE).nullish(),
}).strict()

/**
 * Alta de producto SIN variantes: la creación vive en src/lib/product-create.ts (mismos campos y asiento
 * de stock que el importador Excel; la duplicación con el importador está documentada allí como deuda).
 */
export async function POST(req: Request): Promise<NextResponse> {
  const session = await requireQuickAdd()
  if (session instanceof NextResponse) return session
  const businessId = session.businessId

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }
  const input = parsed.data

  const category = await prisma.category.findFirst({
    where: { id: input.category_id, business_id: businessId, active: true },
    select: { id: true },
  })
  if (!category) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 400 })

  const existing = await findByBarcode(businessId, input.code)
  if (existing) return NextResponse.json({ error: 'Ese código ya existe', code: 'duplicate', existing }, { status: 409 })

  const plan = await checkPlanLimit('create_product')
  if (!plan.allowed) return planDenied(plan.reason)

  try {
    const productId = await prisma.$transaction(tx =>
      createSimpleProduct(tx, {
        businessId,
        userId:       session.userId,
        name:         input.name,
        barcode:      input.code,
        categoryId:   category.id,
        subcategory:  input.subcategory,
        priceUsd:     toMoney(input.price_usd),
        wholesaleUsd: input.wholesale_usd == null ? null : toMoney(input.wholesale_usd),
        quantity:     input.quantity,
        notes:        'Alta rápida',
      }),
    )

    try { await revalidateCatalogCache(businessId) }
    catch (err) { console.error('[quick-add] revalidateCatalogCache falló', { business_id: businessId, err }) }

    return NextResponse.json({ product: await productResult(businessId, productId) }, { status: 201 })
  } catch (err) {
    console.error('quick-add create error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
