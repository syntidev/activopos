import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { z } from 'zod'

const patchSchema = z.object({
  name:                 z.string().min(1).max(80).optional(),
  color:                z.string().max(20).nullable().optional(),
  sort_order:           z.number().int().optional(),
  requires_preparation: z.boolean().optional(),
})

type RouteContext = { params: { id: string } }

const parseId = (raw: string) => {
  const id = parseInt(raw)
  return isNaN(id) ? null : id
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await req.json()
    const data = patchSchema.parse(body)

    const existing = await db.category.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const category = await db.category.update({ where: { id }, data }) // business_id inyectado
    return NextResponse.json({ ok: true, category })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Category patch error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const existing = await db.category.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const activeCount = await db.product.count({
      where: { category_id: id, active: true }, // business_id inyectado
    })
    if (activeCount > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: tiene ${activeCount} producto(s) activo(s)` },
        { status: 409 }
      )
    }

    await db.category.update({ where: { id }, data: { active: false } }) // business_id inyectado
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
