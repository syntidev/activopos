import { NextRequest, NextResponse } from 'next/server'
import {
  badRequest, elementPatchSchema, handleRestauranteError, readJson, requireRestauranteAccess, serializeElement,
} from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

function parseId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

// PATCH /api/restaurante/elementos/[id] — mover, redimensionar o rotular (solo admin)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const id = parseId(params.id)
    if (id === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const parsed = elementPatchSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)

    const row = await access.db.floorElement.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ ok: true, element: serializeElement(row) })
  } catch (err) {
    return handleRestauranteError(err, 'PATCH /api/restaurante/elementos/[id]')
  }
}

// DELETE /api/restaurante/elementos/[id] — solo admin
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const id = parseId(params.id)
    if (id === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    await access.db.floorElement.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRestauranteError(err, 'DELETE /api/restaurante/elementos/[id]')
  }
}
