import { NextRequest, NextResponse } from 'next/server'
import { modifierPatchSchema, toModifier } from '@/lib/restaurante-cuenta'
import { badRequest, handleRestauranteError, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

function parseId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

// PATCH /api/restaurante/modificadores/[id] — solo admin
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const { db } = access
    const id = parseId(params.id)
    if (id === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const parsed = modifierPatchSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    const b = parsed.data

    if (b.product_id && !(await db.product.findFirst({ where: { id: b.product_id }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }
    if (b.category_id && !(await db.category.findFirst({ where: { id: b.category_id }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }
    // Cambiar a un alcance (producto o categoría) limpia el otro.
    const scope = b.product_id ? { category_id: null } : b.category_id ? { product_id: null } : {}

    const row = await db.productModifier.update({ where: { id }, data: { ...b, ...scope } })
    return NextResponse.json({ ok: true, modificador: toModifier(row) })
  } catch (err) {
    return handleRestauranteError(err, 'PATCH /api/restaurante/modificadores/[id]')
  }
}

// DELETE /api/restaurante/modificadores/[id] — solo admin. Las cuentas ya armadas conservan su instantánea.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const id = parseId(params.id)
    if (id === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    await access.db.productModifier.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRestauranteError(err, 'DELETE /api/restaurante/modificadores/[id]')
  }
}
