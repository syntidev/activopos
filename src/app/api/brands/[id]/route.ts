import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { imagePath } from '@/lib/landing-sections'

const trimmed = (max: number) => z.string().trim().min(1).max(max)

const patchSchema = z.object({
  name:        trimmed(60).optional(),
  image_url:   imagePath().nullable().optional(),
  search_term: trimmed(60).optional(),
  visible:     z.boolean().optional(),
  order:       z.number().int().min(0).optional(),
}).strict()

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

    let body: z.infer<typeof patchSchema>
    try {
      body = patchSchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      }
      throw err
    }

    const existing = await db.brand.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const brand = await db.brand.update({
      where: { id }, // business_id inyectado
      data: {
        ...(body.name        !== undefined ? { name:        body.name }        : {}),
        ...(body.image_url   !== undefined ? { image_url:   body.image_url }   : {}),
        ...(body.search_term !== undefined ? { search_term: body.search_term } : {}),
        ...(body.visible     !== undefined ? { visible:     body.visible }     : {}),
        ...(body.order       !== undefined ? { order:       body.order }       : {}),
      },
    })

    return NextResponse.json({ ok: true, brand })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const existing = await db.brand.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    await db.brand.delete({ where: { id } }) // business_id inyectado

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
