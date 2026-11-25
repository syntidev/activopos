import { NextRequest, NextResponse } from 'next/server'
import { tableOpenAccountId } from '@/lib/restaurante-cuenta'
import {
  TABLE_INCLUDE, TABLE_STRUCTURAL_KEYS, badRequest, handleRestauranteError, readJson,
  requireRestauranteAccess, serializeTable, tablePatchSchema,
} from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

function parseId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * PATCH /api/restaurante/mesas/[id]
 *  - Estructura (posición, tamaño, capacidad, forma, etiqueta, activa): solo admin.
 *  - Marcas manuales (por limpiar, reserva): cualquier rol con acceso al salón.
 * "Ocupada" y "por cobrar" no se pueden fijar aquí: se derivan de la cuenta.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access
    const id = parseId(params.id)
    if (id === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const parsed = tablePatchSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    const { reserved_at, ...rest } = parsed.data

    if (!access.isAdmin && TABLE_STRUCTURAL_KEYS.some(k => k in rest)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }
    // Una mesa con cuenta abierta no se desactiva ni se pasa a otra área: la cuenta quedaría huérfana.
    if (rest.active === false || rest.area_id !== undefined) {
      const open = await tableOpenAccountId(access.db, id)
      if (open !== null) return NextResponse.json({ error: 'La mesa tiene una cuenta abierta. Ciérrala antes de cambiarla.', code: 'TABLE_HAS_OPEN_ACCOUNT', account_id: open }, { status: 409 })
    }
    if (rest.area_id !== undefined) {
      const area = await access.db.serviceArea.findFirst({ where: { id: rest.area_id } })
      if (!area) return NextResponse.json({ error: 'Área no encontrada' }, { status: 404 })
    }

    // Quitar la reserva limpia también el teléfono y la hora.
    const clearReservation = rest.reserved_for === null
    const row = await access.db.diningTable.update({
      where: { id },
      data: {
        ...rest,
        ...(clearReservation ? { reserved_phone: null, reserved_at: null } : {}),
        ...(reserved_at !== undefined && !clearReservation ? { reserved_at: reserved_at === null ? null : new Date(reserved_at) } : {}),
      },
      include: TABLE_INCLUDE,
    })
    return NextResponse.json({ ok: true, table: serializeTable(row) })
  } catch (err) {
    return handleRestauranteError(err, 'PATCH /api/restaurante/mesas/[id]')
  }
}

// DELETE /api/restaurante/mesas/[id] — solo admin; se niega si la mesa tiene una cuenta abierta
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const id = parseId(params.id)
    if (id === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const open = await tableOpenAccountId(access.db, id)
    if (open !== null) {
      return NextResponse.json({ error: 'La mesa tiene una cuenta abierta. Ciérrala antes de eliminarla.', code: 'TABLE_HAS_OPEN_ACCOUNT', account_id: open }, { status: 409 })
    }
    await access.db.diningTable.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRestauranteError(err, 'DELETE /api/restaurante/mesas/[id]')
  }
}
