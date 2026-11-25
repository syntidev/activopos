import { NextRequest, NextResponse } from 'next/server'
import { modifierCreateSchema, toModifier } from '@/lib/restaurante-cuenta'
import { badRequest, handleRestauranteError, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'

// GET /api/restaurante/modificadores — todos los modificadores del negocio (con los inactivos, para la configuración)
export async function GET() {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access
    const { db } = access
    const rows = await db.productModifier.findMany({ orderBy: [{ sort_order: 'asc' }, { id: 'asc' }], take: 500 })
    const [products, categories] = await Promise.all([
      db.product.findMany({ where: { id: { in: rows.flatMap(r => (r.product_id ? [r.product_id] : [])) } }, select: { id: true, name: true } }),
      db.category.findMany({ where: { id: { in: rows.flatMap(r => (r.category_id ? [r.category_id] : [])) } }, select: { id: true, name: true } }),
    ])
    const productName = new Map(products.map(p => [p.id, p.name]))
    const categoryName = new Map(categories.map(c => [c.id, c.name]))
    return NextResponse.json({
      ok: true,
      modificadores: rows.map(r => ({
        ...toModifier(r),
        scope_label: r.product_id ? (productName.get(r.product_id) ?? 'Producto') : r.category_id ? (categoryName.get(r.category_id) ?? 'Categoría') : 'Todo el negocio',
      })),
    })
  } catch (err) {
    return handleRestauranteError(err, 'GET /api/restaurante/modificadores')
  }
}

// POST /api/restaurante/modificadores — solo admin. product_id y category_id vacíos = aplica a todo el negocio
export async function POST(req: NextRequest) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const { db, session } = access

    const parsed = modifierCreateSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    const b = parsed.data

    // El producto o la categoría tienen que ser de este negocio (el scope de tenant filtra por business_id).
    if (b.product_id && !(await db.product.findFirst({ where: { id: b.product_id }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }
    if (b.category_id && !(await db.category.findFirst({ where: { id: b.category_id }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    const row = await db.productModifier.create({
      data: {
        business_id: session.businessId, product_id: b.product_id ?? null, category_id: b.category_id ?? null,
        group_name: b.group_name ?? null, name: b.name, price_usd: b.price_usd, required: b.required ?? false, sort_order: b.sort_order ?? 0,
      },
    })
    return NextResponse.json({ ok: true, modificador: toModifier(row) }, { status: 201 })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/modificadores')
  }
}
