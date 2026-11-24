import { NextRequest, NextResponse } from 'next/server'
import {
  areaPatchSchema, badRequest, handleRestauranteError, readJson, requireRestauranteAccess, serializeArea,
} from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

function parseId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

// PATCH /api/restaurante/areas/[id] — renombrar, ordenar o activar/desactivar (solo admin)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const id = parseId(params.id)
    if (id === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const parsed = areaPatchSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)

    const row = await access.db.serviceArea.update({
      where:   { id },
      data:    parsed.data,
      include: { _count: { select: { tables: { where: { active: true } } } } },
    })
    return NextResponse.json({ ok: true, area: serializeArea(row, row._count.tables) })
  } catch (err) {
    return handleRestauranteError(err, 'PATCH /api/restaurante/areas/[id]')
  }
}

// DELETE /api/restaurante/areas/[id] — solo si no tiene mesas ni mobiliario (para sacarla de uso: active=false)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const id = parseId(params.id)
    if (id === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const [tables, elements] = await Promise.all([
      access.db.diningTable.count({ where: { area_id: id } }),
      access.db.floorElement.count({ where: { area_id: id } }),
    ])
    if (tables + elements > 0) {
      return NextResponse.json({ error: 'El área tiene mesas o elementos del plano: desactívala en lugar de borrarla' }, { status: 409 })
    }
    await access.db.serviceArea.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRestauranteError(err, 'DELETE /api/restaurante/areas/[id]')
  }
}
